  // -----------------------------------------------------------------
  // Métricas gerais (churn, MRR, retencao)
  // -----------------------------------------------------------------
  private async metricaGerais(period: ReportPeriod): Promise<Record<string, unknown>> {
    const now = new Date();

    // --- MRR ---
    const mrrAgg = await this.db.contract.aggregate({
      where: {
        status: 'SIGNED',
        startDate: { lte: now },
        endDate: { gte: now },
      },
      _sum: { monthlyAmount: true },
      _count: { _all: true },
    });

    // --- Churn ---
    const activeAtStart = await this.db.contract.count({
      where: {
        signedAt: { not: null },
        startDate: { lte: period.from },
        endDate: { gte: period.from },
        OR: [{ cancelledAt: null }, { cancelledAt: { gte: period.from } }],
      },
    });

    const cancelados = await this.db.contract.count({
      where: {
        status: 'CANCELLED',
        signedAt: { not: null },
        startDate: { lte: period.from },
        cancelledAt: { gte: period.from, lte: period.to },
      },
    });

    const expiradosNoPeriodo = await this.db.contract.findMany({
      where: {
        status: 'EXPIRED',
        signedAt: { not: null },
        startDate: { lte: period.from },
        endDate: { gte: period.from, lte: period.to },
      },
      select: { id: true, studentId: true, endDate: true },
    });
    const expiradosIDs = new Set(expiradosNoPeriodo.map((c) => c.id));
    const renovados = expiradosIDs.size === 0 ? new Set<string>() : await this.renewedContractIds(expiradosNoPeriodo);
    const naoRenovados = expiradosNoPeriodo.length - renovados.size;
    const churnTotal = cancelados + naoRenovados;

    // --- Retencao ---
    const encerradosRet = await this.db.contract.findMany({
      where: {
        cycle: { in: ['MONTHS_3', 'MONTHS_6', 'MONTHS_12'] },
        signedAt: { not: null },
        OR: [
          { endDate: { gte: period.from, lte: period.to } },
          { status: 'CANCELLED', cancelledAt: { gte: period.from, lte: period.to } },
        ],
      },
      select: { id: true },
    });
    const contraRetidas = encerradosRet.filter((c) => renovados.has(c.id)).length;

    return {
      churn: {
        baseNoInicio: activeAtStart,
        cancelamentoAntecipado: {
          quantidade: cancelados,
          taxa: Number(((cancelados / activeAtStart) * 100).toFixed(4)),
        },
        naoRenovacao: {
          quantidade: naoRenovados,
          taxa: Number(((naoRenovados / activeAtStart) * 100).toFixed(4)),
        },
        total: churnTotal,
        taxaTotal: Number(((churnTotal / activeAtStart) * 100).toFixed(4)),
      },
      retencaoPorCiclo: {
        coorte: encerradosRet.length,
        retidos: contraRetidas,
        taxa: encerradosRet.length === 0 ? null : Number(((contraRetidas / encerradosRet.length) * 100).toFixed(4)),
      },
    };
  }

  private async renewedContractIds(ended: { id: string; studentId: string; endDate: Date }[]): Promise<Set<string>> {
    const renewed = new Set<string>();
    if (ended.length === 0) return renewed;

    const studentIds = [...new Set(ended.map((c) => c.studentId))];
    const times = ended.map((c) => c.endDate.getTime());
    const minStart = new Date(Math.min(...times) - DAY_MS);
    const maxStart = new Date(Math.max(...times) + BI_RULES.JANELA_RENOVACAO_DIAS * DAY_MS);

    const candidates = await this.db.contract.findMany({
      where: {
        studentId: { in: studentIds },
        signedAt: { not: null },
        startDate: { gte: minStart, lte: maxStart },
      },
      select: { id: true, studentId: true, startDate: true },
    });

    for (const c of ended) {
      const lo = c.endDate.getTime();
      const hi = c.endDate.getTime() + BI_RULES.JANELA_RENOVACAO_DIAS * DAY_MS;
      const hasNext = candidates.some(
        (n) => n.studentId === c.studentId && n.id !== c.id && n.startDate.getTime() >= lo && n.startDate.getTime() <= hi,
      );
      if (hasNext) renewed.add(c.id);
    }
    return renewed;
  }
  // -----------------------------------------------------------------
  // Agregados do relatorio geral
  // -----------------------------------------------------------------
  async summary(period: ReportPeriod) {
    await this.requirePeriod(period);

    const now = new Date();
    const cutoffInadimplencia = new Date(now.getTime() - BI_RULES.INADIMPLENCIA_DIAS_PIX * DAY_MS);

    const [students, appointments, executions, confirmedParcels, confirmedExtras, overdueParcels, overdueExtras] =
      await Promise.all([
        this.db.student.findMany({
          where: { active: true, anonymizedAt: null },
          select: { id: true, name: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),

        this.db.appointment.groupBy({
          by: ['studentId', 'status'],
          where: { startsAt: { gte: period.from, lt: period.to } },
          _count: { _all: true },
        }),

        this.db.workoutExecution.findMany({
          where: { startedAt: { gte: period.from, lt: period.to } },
          orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
          take: 10_000,
          select: {
            id: true,
            studentId: true,
            status: true,
            startedAt: true,
            setLogs: {
              select: { loadKg: true, workoutExercise: { select: { name: true } } },
            },
          },
        }),

        this.db.paymentParcel.aggregate({
          where: { status: ParcelStatus.CONFIRMED, amount: { not: null } },
          _sum: { amount: true },
          _count: { _all: true },
        }),

        this.db.extraPayment.aggregate({
          where: { status: ParcelStatus.CONFIRMED, amount: { not: null } },
          _sum: { amount: true },
          _count: { _all: true },
        }),

        this.db.paymentParcel.aggregate({
          where: { status: ParcelStatus.PENDING, dueDate: { lt: cutoffInadimplencia } },
          _sum: { amount: true },
          _count: { _all: true },
        }),

        this.db.extraPayment.aggregate({
          where: { status: ParcelStatus.PENDING, dueDate: { lt: cutoffInadimplencia } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
      ]);

    const activeStudentIds = new Set(students.map((s) => s.id));
    const progressByStudent = new Map<string, { studentId: string; studentName: string; workoutSessions: number; completedWorkouts: number; inProgressWorkouts: number; evolution: any[]; attendance: any }>();
    const pointsByStudent = new Map<string, Map<string, { at: Date; loadKg: number }[]>>();

    for (const execution of executions) {
      if (!activeStudentIds.has(execution.studentId)) continue;

      let progress = progressByStudent.get(execution.studentId);
      if (!progress) {
        const student = students.find((s) => s.id === execution.studentId);
        progress = {
          studentId: execution.studentId,
          studentName: student?.name ?? '',
          workoutSessions: 0,
          completedWorkouts: 0,
          inProgressWorkouts: 0,
          evolution: [],
          attendance: { completed: 0, scheduled: 0, cancelled: 0, total: 0 },
        };
        progressByStudent.set(execution.studentId, progress);
        pointsByStudent.set(execution.studentId, new Map());
      }
      progress.workoutSessions += 1;
      if (execution.status === 'COMPLETED') progress.completedWorkouts += 1;
      else progress.inProgressWorkouts += 1;

      const maxLoadByExercise = new Map<string, number>();
      for (const log of execution.setLogs) {
        if (log.loadKg === null || log.loadKg === undefined) continue;
        const load = Number(log.loadKg);
        if (!Number.isFinite(load) || load < 0) continue;
        const exercise = log.workoutExercise.name;
        maxLoadByExercise.set(exercise, Math.max(maxLoadByExercise.get(exercise) ?? 0, load));
      }

      const sp = pointsByStudent.get(execution.studentId);
      if (sp) {
        for (const [exercise, loadKg] of maxLoadByExercise) {
          const pts = sp.get(exercise) ?? [];
          pts.push({ at: execution.startedAt, loadKg });
          sp.set(exercise, pts);
        }
      }
    }

    for (const [studentId, exercises] of pointsByStudent) {
      const progress = progressByStudent.get(studentId)!;
      const pbe: Array<{ exercise: string; firstLoadKg: number; latestLoadKg: number; changeKg: number; changePercent: number | null; observations: number }> = [];
      for (const [exercise, pts] of exercises) {
        pts.sort((a, b) => a.at.getTime() - b.at.getTime());
        const firstLoadKg = pts[0].loadKg;
        const latestLoadKg = pts[pts.length - 1].loadKg;
        const changeKg = latestLoadKg - firstLoadKg;
        pbe.push({
          exercise,
          firstLoadKg: Number(firstLoadKg.toFixed(2)),
          latestLoadKg: Number(latestLoadKg.toFixed(2)),
          changeKg: Number(changeKg.toFixed(2)),
          changePercent: firstLoadKg === 0 ? null : Number(((changeKg / firstLoadKg) * 100).toFixed(1)),
          observations: pts.length,
        });
      }
      progress.evolution = pbe.sort((a, b) => a.exercise.localeCompare(b.exercise, 'pt'));
    }

    const appointmentTotals = { completed: 0, scheduled: 0, cancelled: 0 };
    for (const entry of appointments) {
      const ls = entry.status.toLowerCase();
      if (ls === 'completed') appointmentTotals.completed += entry._count._all;
      else if (ls === 'scheduled') appointmentTotals.scheduled += entry._count._all;
      else if (ls === 'cancelled') appointmentTotals.cancelled += entry._count._all;
    }
    const attendedAppointments = appointmentTotals.completed + appointmentTotals.scheduled;
    const attendance = {
      ...appointmentTotals,
      total: appointmentTotals.completed + appointmentTotals.scheduled + appointmentTotals.cancelled,
      completionRate: attendedAppointments === 0 ? null : Number(((appointmentTotals.completed / attendedAppointments) * 100).toFixed(4)),
    };

    const confirmedRevenue = Number(normalizeAmount((confirmedParcels._sum.amount as any) ?? null)) + Number(normalizeAmount((confirmedExtras._sum.amount as any) ?? null));
    const confirmedPayments = confirmedParcels._count._all + confirmedExtras._count._all;
    const overdueAmount = Number(normalizeAmount((overdueParcels._sum.amount as any) ?? null)) + Number(normalizeAmount((overdueExtras._sum.amount as any) ?? null));
    const overduePayments = overdueParcels._count._all + overdueExtras._count._all;
    const financialStatus = {
      confirmado: { valor: Number(confirmedRevenue.toFixed(2)), pagamentos: confirmedPayments },
      inadimplencia: { valor: Number(overdueAmount.toFixed(2)), parcelas: overduePayments },
    };

    return {
      perodo: { from: period.from, to: period.to },
      alunos: [...progressByStudent.values()],
      agenda: { frequencia: attendance },
      financas: financialStatus,
      metricas: await this.metricaGerais(period),
    };
  }

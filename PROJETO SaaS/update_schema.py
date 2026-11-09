with open("prisma/schema.prisma", "r") as f:
    content = f.read()

# Adiciona a relação inversa no modelo Aluno se já não existir
if "treinos" not in content:
    content = content.replace(
        "  updatedAt         DateTime @updatedAt\n}",
        "  updatedAt         DateTime @updatedAt\n  treinos           Treino[]\n}"
    )
    with open("prisma/schema.prisma", "w") as f:
        f.write(content)
    print("Schema atualizado com sucesso!")
else:
    print("A relação já existe no schema.")

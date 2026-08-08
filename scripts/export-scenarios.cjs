const { writeFile } = require("node:fs/promises");
const { PrismaClient } = require("@prisma/client");

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) {
    throw new Error("Usage: node scripts/export-scenarios.cjs <output-path>");
  }

  const prisma = new PrismaClient();
  try {
    const scenarios = await prisma.scenario.findMany({
      orderBy: { createdAt: "asc" },
    });
    await writeFile(outputPath, JSON.stringify(scenarios, null, 2));
    console.log(`Exported ${scenarios.length} scenarios to ${outputPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import bcrypt from "bcryptjs";
import { prisma } from "../src/config/prisma";

async function main(): Promise<void> {
  const password = "Admin@12345";
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@assessment.dev" },
    create: {
      email: "admin@assessment.dev",
      passwordHash,
      fullName: "Platform Admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
    update: {
      passwordHash,
      fullName: "Platform Admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const companyUser = await prisma.user.upsert({
    where: { email: "company@assessment.dev" },
    create: {
      email: "company@assessment.dev",
      fullName: "Acme Talent",
      passwordHash: await bcrypt.hash("Company@12345", 12),
      role: "COMPANY",
      status: "ACTIVE",
      companyProfile: {
        create: {
          companyName: "Acme Talent",
          industry: "Software",
          size: "200-500",
          about: "Demo recruiter company for evaluation.",
          website: "https://acme.example.com",
        },
      },
    },
    update: {},
    include: { companyProfile: true },
  });

  const candidateUser = await prisma.user.upsert({
    where: { email: "candidate@assessment.dev" },
    create: {
      email: "candidate@assessment.dev",
      fullName: "Jane Developer",
      passwordHash: await bcrypt.hash("Candidate@12345", 12),
      role: "CANDIDATE",
      status: "ACTIVE",
      candidateProfile: {
        create: {
          headline: "Full-stack Engineer",
          skills: ["JavaScript", "TypeScript", "Node.js", "React"],
          githubUrl: "https://github.com/jane",
        },
      },
    },
    update: {},
    include: { candidateProfile: true },
  });

  const existingProblems = await prisma.problem.count();
  if (existingProblems === 0) {
    await prisma.problem.createMany({
      data: [
        {
          title: "Two Sum (MCQ)",
          description: "Which time complexity is optimal for the classic Two Sum using hashmap lookup?",
          type: "MCQ",
          difficulty: "EASY",
          tags: ["algorithms", "arrays"],
          options: ["O(n log n)", "O(n)", "O(n^2)", "O(1)"],
          correctOption: "O(n)",
          points: 10,
          createdById: companyUser.id,
        },
        {
          title: "Reverse a String (Coding)",
          description:
            "Write a function `reverseString(s: string): string` that returns the input string reversed.",
          type: "CODING",
          difficulty: "EASY",
          tags: ["strings"],
          language: "javascript",
          starterCode:
            "function reverseString(s) {\n  // your code here\n  return s;\n}",
          testCases: [
            { input: "hello", expectedOutput: "olleh", isHidden: false },
            { input: "abcd", expectedOutput: "dcba", isHidden: true },
          ],
          points: 20,
          createdById: companyUser.id,
        },
        {
          title: "Explain Event Loop (Written)",
          description:
            "In your own words, explain how JavaScript's event loop handles microtasks vs macrotasks.",
          type: "WRITTEN",
          difficulty: "MEDIUM",
          tags: ["javascript", "async"],
          referenceAnswer:
            "The event loop executes macrotasks (e.g. setTimeout) and microtasks (e.g. Promise callbacks) in distinct phases, draining the microtask queue between each macrotask.",
          points: 15,
          createdById: companyUser.id,
        },
      ],
    });
  }

  console.log("\n=== SEED COMPLETE ===");
  console.log("Admin login     :", admin.email, "/", password);
  console.log("Company login   :", "company@assessment.dev", "/", "Company@12345");
  console.log("Candidate login :", candidateUser.email, "/", "Candidate@12345\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// Homepage index rows. `dirs` are paths under docs/ whose notes count toward the row;
// the notes-index plugin reads them at build time to compute counts, depth and dates.
export type Topic = {
  title: string;
  description: string;
  to: string;
  dirs: string[];
};

export const topics: Topic[] = [
  {
    title: "React",
    description: "Hooks, rendering, state management, routing, data fetching.",
    to: "/docs/FrontEnd/react/react-mastery-path",
    dirs: ["FrontEnd/react"],
  },
  {
    title: ".NET and C#",
    description: "ASP.NET Core, Clean Architecture, SOLID, EF Core, interview questions.",
    to: "/docs/category/dotnet",
    dirs: ["BackEnd/dotnet", "BackEnd/csharp"],
  },
  {
    title: "Databases",
    description: "SQL Server internals, locking and isolation, Postgres, MongoDB.",
    to: "/docs/category/databases",
    dirs: ["Data/databases"],
  },
  {
    title: "System design",
    description: "Architecture patterns, scalability, distributed systems.",
    to: "/docs/category/system-design",
    dirs: ["system-design"],
  },
  {
    title: "Azure",
    description: "AKS, Service Bus, Functions, Entra ID, Data Factory.",
    to: "/docs/Cloud/azure/intro",
    dirs: ["Cloud/azure"],
  },
  {
    title: "DevOps",
    description: "Docker, Kubernetes, CI/CD, Terraform, Argo CD.",
    to: "/docs/devops/devops-lifecycle-roadmap",
    dirs: ["devops"],
  },
  {
    title: "Data warehousing",
    description: "Dimensional modeling, ETL, warehouse platforms.",
    to: "/docs/category/data-warehouse",
    dirs: ["Data/data-warehouse"],
  },
  {
    title: "Artificial intelligence",
    description: "ML foundations, LLMs, RAG, agents, evaluation, LLMOps.",
    to: "/docs/Artificial Intelligence/overview",
    dirs: ["Artificial Intelligence"],
  },
  {
    title: "Node.js",
    description: "Runtime, event loop, and a learning roadmap.",
    to: "/docs/BackEnd/nodejs/nodejs-roadmap",
    dirs: ["BackEnd/nodejs"],
  },
  {
    title: "Behavioral",
    description: "Self-introduction and interview stories.",
    to: "/docs/category/behavioral",
    dirs: ["Behavioral"],
  },
  {
    title: "Python",
    description: "Language basics and a learning roadmap.",
    to: "/docs/BackEnd/python/python-roadmap",
    dirs: ["BackEnd/python"],
  },
  {
    title: "Data structures and algorithms",
    description: "Arrays through dynamic programming.",
    to: "/docs/category/dsa",
    dirs: ["dsa"],
  },
];

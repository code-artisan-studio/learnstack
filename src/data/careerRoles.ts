// Career page content. To add a recommended course, append {name, platform, url}
// to the end of a role's `courses`; completion is stored by position, so
// reordering existing courses moves saved check marks.
export type Course = { name: string; platform: string; url: string };

export type Phase = { span: string; goal: string; action: string };

export type Role = {
  id: string;
  name: string;
  focus: string;
  core: string[];
  advanced: string[];
  domain: string[];
  tools: string[];
  soft: string[];
  certs: string[];
  roadmap: Phase[];
  courses: Course[];
};

export const roles: Role[] = [
  {
    id: "fde",
    name: "Forward Deployed Engineer",
    focus: "Build and deploy customer-specific technical solutions, translating real operational needs into reliable and reusable product capabilities.",
    core: [
      "Production software engineering in Python, TypeScript, Java, Go, or similar",
      "API integration, authentication, and data-contract management",
      "SQL, data modeling, ETL/ELT, and data-quality validation",
      "Cloud-native deployment, testing, CI/CD, and observability",
      "Distributed-systems debugging and production incident response"
    ],
    advanced: [
      "Rapid prototyping under ambiguous customer requirements",
      "Multi-tenant architecture and product abstraction from field work",
      "Enterprise identity, network, security, and legacy-system integration",
      "AI/ML or LLM solution integration where relevant",
      "Offline, edge, regulated, or high-security deployments"
    ],
    domain: [
      "Customer discovery, pilot, rollout, adoption, and support lifecycles",
      "Enterprise security reviews, procurement, and change management",
      "Target-industry operations and regulatory constraints",
      "Data governance, privacy, and commercial scope tradeoffs"
    ],
    tools: [
      "GitHub/GitLab",
      "Docker, Kubernetes, and Terraform",
      "AWS, Azure, or Google Cloud",
      "PostgreSQL, warehouses, queues, and REST/GraphQL APIs",
      "Datadog, Grafana, OpenTelemetry, Jira, and customer-support tools"
    ],
    soft: [
      "Customer empathy and consultative problem framing",
      "Clear communication with engineers, operators, and executives",
      "Independent work in unfamiliar environments",
      "Scope control, prioritization, and diplomacy",
      "Solution-design and implementation-plan writing"
    ],
    certs: [
      "Degree or equivalent production engineering experience",
      "AWS/Azure/GCP architecture certification",
      "Secure-development fundamentals",
      "Industry clearance or compliance credential when applicable"
    ],
    roadmap: [
      {
        span: "0–3 months",
        goal: "Strengthen implementation fundamentals",
        action: "Ship an end-to-end integration with authentication, persistence, testing, deployment, and monitoring."
      },
      {
        span: "3–9 months",
        goal: "Build field-facing depth",
        action: "Lead an integration, migration, or rollout; practice discovery and quantify adoption."
      },
      {
        span: "9–18 months",
        goal: "Show product influence",
        action: "Turn one-off deployment lessons into reusable product patterns and a case-study portfolio."
      }
    ],
    courses: [
      {
        name: "Docker and Kubernetes: The Complete Guide",
        platform: "Udemy",
        url: "https://www.udemy.com/course/docker-and-kubernetes-the-complete-guide/"
      },
      {
        name: "Grokking the System Design Interview",
        platform: "DesignGurus.io",
        url: "https://www.designgurus.io/course/grokking-the-system-design-interview"
      }
    ]
  },
  {
    id: "principal",
    name: "Principal Architect/Engineer",
    focus: "Set technical direction across multiple systems, solve the organization’s highest-leverage problems, and connect technology decisions to business strategy.",
    core: [
      "Expert system design across services, platforms, data, and infrastructure",
      "Architecture tradeoffs: cost, reliability, security, scalability, and organizational fit",
      "Distributed systems, consistency models, asynchronous processing, and failure handling",
      "API, platform, and domain-driven architecture",
      "Performance, capacity, resilience, and security architecture"
    ],
    advanced: [
      "Enterprise platform strategy and portfolio rationalization",
      "Complex legacy modernization and incremental migration",
      "Global scale, high availability, and disaster recovery",
      "Data, AI, or developer-platform architecture",
      "Technical due diligence and enabling architecture governance"
    ],
    domain: [
      "Business strategy and operating-model awareness",
      "Cloud economics, TCO, ROI, and build-versus-buy analysis",
      "Conway’s Law and organizational design",
      "Industry regulation, privacy, and audit requirements",
      "Vendor ecosystems and technology lifecycle management"
    ],
    tools: [
      "Cloud architecture services",
      "Kubernetes, service mesh, API gateways, and platform tooling",
      "C4, ArchiMate, UML, ADRs, and capability maps",
      "Observability, threat-modeling, and FinOps tooling",
      "Data streaming, lakehouse, and governance platforms"
    ],
    soft: [
      "Executive decision framing",
      "Influence without authority",
      "Cross-organization alignment and conflict resolution",
      "Mentoring senior and staff engineers",
      "Long-horizon thinking with near-term delivery discipline"
    ],
    certs: [
      "Typically 12+ years or equivalent breadth of impact",
      "Cloud architect credentials when useful",
      "TOGAF or enterprise-architecture training where relevant",
      "Security, data, or industry-specific credentials"
    ],
    roadmap: [
      {
        span: "0–6 months",
        goal: "Broaden influence",
        action: "Own architecture for a multi-team initiative; write a target-state architecture and explicit tradeoffs."
      },
      {
        span: "6–18 months",
        goal: "Lead strategic change",
        action: "Guide a modernization, platform, or reliability program and establish adopted standards."
      },
      {
        span: "18–36 months",
        goal: "Create principal evidence",
        action: "Influence technical strategy and demonstrate organization-wide leverage in cost, risk, or delivery."
      }
    ],
    courses: [
      {
        name: "Ultimate AWS Certified Solutions Architect Professional",
        platform: "Udemy",
        url: "https://www.udemy.com/course/aws-solutions-architect-professional/"
      },
      {
        name: "Software Design and Architecture Specialization",
        platform: "Coursera",
        url: "https://www.coursera.org/specializations/software-design-architecture"
      }
    ]
  },
  {
    id: "architect",
    name: "Software Architect",
    focus: "Design coherent, maintainable software systems and help engineering teams implement them safely and consistently.",
    core: [
      "Application, service, API, and database architecture",
      "Object-oriented design, functional patterns, and domain-driven design",
      "Monolith, microservice, event-driven, and serverless patterns",
      "Security by design: identity, authorization, and secrets management",
      "Testing strategy, release engineering, and production readiness"
    ],
    advanced: [
      "Strangler-fig modernization and migration architecture",
      "High-volume and low-latency performance work",
      "Multi-region resilience and disaster recovery",
      "Developer-experience and platform architecture",
      "Automated guardrails and reference implementations"
    ],
    domain: [
      "Business workflows and core domain entities",
      "Nonfunctional requirements: availability, latency, auditability, and accessibility",
      "Privacy, regulatory, and lifecycle requirements",
      "Technical-debt prioritization and build-versus-buy decisions"
    ],
    tools: [
      "JVM, .NET, Node.js, Python, Go, or relevant ecosystem",
      "Relational and NoSQL databases",
      "Docker, Kubernetes, CI/CD, and infrastructure as code",
      "Cloud services, static analysis, dependency scanning, and observability",
      "Architecture diagrams and ADR repositories"
    ],
    soft: [
      "Facilitating productive design reviews",
      "Teaching principles through practical examples",
      "Balancing ideal design with delivery constraints",
      "Risk communication and constructive disagreement",
      "Partnership with product, security, operations, and engineering"
    ],
    certs: [
      "Record of delivering multiple production systems",
      "Cloud architecture certification when aligned",
      "Secure-development training",
      "Architecture-framework training for enterprise settings"
    ],
    roadmap: [
      {
        span: "0–4 months",
        goal: "Formalize practice",
        action: "Lead design reviews, use ADRs, and map an existing system with prioritized improvements."
      },
      {
        span: "4–12 months",
        goal: "Own architecture through delivery",
        action: "Architect a substantial subsystem and lead a reliability, performance, or modernization initiative."
      },
      {
        span: "12–24 months",
        goal: "Demonstrate stewardship",
        action: "Guide multiple teams through shared direction; document measurable improvements and case studies."
      }
    ],
    courses: [
      {
        name: "Domain-Driven Design and Microservices",
        platform: "Udemy",
        url: "https://www.udemy.com/course/domain-driven-design-and-microservices/"
      },
      {
        name: "Software Design and Architecture Specialization",
        platform: "Coursera",
        url: "https://www.coursera.org/specializations/software-design-architecture"
      }
    ]
  },
  {
    id: "staff",
    name: "Staff Software Engineer",
    focus: "Multiply engineering effectiveness through technical leadership, cross-team problem solving, and ownership of high-impact systems.",
    core: [
      "Expert proficiency in the team’s primary language and systems",
      "System design, service ownership, and distributed-systems operations",
      "Code quality, testing, debugging, performance, and secure development",
      "Data modeling, API design, integration, and reliability engineering",
      "Technical decomposition and incremental delivery planning"
    ],
    advanced: [
      "Cross-team platform design and technical strategy",
      "Legacy modernization with risk-managed migration",
      "Scalability engineering and capacity forecasting",
      "Multi-quarter technical leadership under ambiguity",
      "Reusable organizational libraries, patterns, and standards"
    ],
    domain: [
      "Customer journeys, business metrics, and product strategy",
      "Operational risk, privacy, compliance, and security",
      "Team topology and dependency management",
      "Engineering metrics and delivery effectiveness"
    ],
    tools: [
      "Language ecosystem, builds, Git, and CI/CD",
      "Feature flags, release management, and incident tooling",
      "Cloud, containers, orchestration, and infrastructure as code",
      "Logs, metrics, traces, databases, caches, queues, and streams"
    ],
    soft: [
      "Technical leadership without authority",
      "Mentoring and raising engineering standards",
      "Concise decision and design communication",
      "Cross-functional stakeholder alignment",
      "Calm incident leadership and evidence-based disagreement"
    ],
    certs: [
      "Usually 8+ years or equivalent senior-level impact",
      "Cloud/security credentials only where they add useful credibility",
      "Evidence of mentoring and cross-team leadership"
    ],
    roadmap: [
      {
        span: "0–6 months",
        goal: "Move beyond assigned work",
        action: "Own a complex subsystem, write alignment-focused designs, and mentor peers."
      },
      {
        span: "6–18 months",
        goal: "Create cross-team leverage",
        action: "Lead a multi-team initiative and eliminate a systemic technical bottleneck."
      },
      {
        span: "18–30 months",
        goal: "Build the staff narrative",
        action: "Show durable impact on velocity, reliability, revenue, cost, or risk; document scope and influence."
      }
    ],
    courses: [
      {
        name: "Grokking the System Design Interview",
        platform: "DesignGurus.io",
        url: "https://www.designgurus.io/course/grokking-the-system-design-interview"
      },
      {
        name: "Domain-Driven Design and Microservices",
        platform: "Udemy",
        url: "https://www.udemy.com/course/domain-driven-design-and-microservices/"
      }
    ]
  },
  {
    id: "tpm",
    name: "Technical Program Manager",
    focus: "Turn strategy into coordinated execution across complex technical initiatives, while managing dependencies, risk, and stakeholder alignment.",
    core: [
      "Technical fluency in SDLC, architecture, cloud, APIs, and data systems",
      "Critical-path planning, dependency mapping, milestones, and scope control",
      "Risk, issue, assumption, and decision management",
      "Requirements traceability, release readiness, and post-launch measurement",
      "Technical documentation, delivery forecasting, and dashboards"
    ],
    advanced: [
      "Multi-year portfolio planning and investment sequencing",
      "Platform migration, security, infrastructure, or compliance programs",
      "Operating-model and governance design",
      "Scenario planning, resource modeling, and executive decision support",
      "Recovery of delayed or high-risk programs"
    ],
    domain: [
      "Product strategy, customers, and commercial objectives",
      "Agile, Scrum, Kanban, and hybrid delivery models",
      "Security, privacy, accessibility, and regulatory obligations",
      "Change management, adoption, vendors, and procurement"
    ],
    tools: [
      "Jira, Azure DevOps, Linear, Asana, or equivalents",
      "Confluence, Notion, Google Workspace, or Microsoft 365",
      "Aha!, Productboard, or roadmapping tools",
      "Spreadsheets, SQL basics, Looker, Tableau, or Power BI",
      "Slack, Teams, Miro, incident-management, and observability tools"
    ],
    soft: [
      "Executive-ready communication",
      "Meeting facilitation and decision capture",
      "Negotiation and conflict resolution",
      "Structured problem solving and proportionate escalation",
      "Influence without authority and empathy for engineering constraints"
    ],
    certs: [
      "PMP, PgMP, PMI-ACP, PRINCE2, or CSM where valued",
      "SAFe certification in SAFe organizations",
      "Technical experience or demonstrable technical fluency",
      "Cloud fundamentals certification as a supplement"
    ],
    roadmap: [
      {
        span: "0–3 months",
        goal: "Build execution foundations",
        action: "Create integrated plans, dependency maps, risk registers, and executive status updates; support a cross-functional program."
      },
      {
        span: "3–12 months",
        goal: "Lead a visible initiative",
        action: "Run a multi-team project with measurable milestones, escalation paths, and launch success criteria."
      },
      {
        span: "12–24 months",
        goal: "Demonstrate strategic scope",
        action: "Lead a high-dependency program and improve organizational delivery mechanisms, not only one launch."
      }
    ],
    courses: [
      {
        name: "Technical Program Management",
        platform: "Udemy",
        url: "https://www.udemy.com/course/technical-program-management/"
      },
      {
        name: "Google Project Management Professional Certificate",
        platform: "Coursera",
        url: "https://www.coursera.org/professional-certificates/google-project-management"
      }
    ]
  }
];

# PC-AI-Assistant -- Learning Tracker

> Started: 2026-03-31
> Background: Java Core only
> Goal: Become an AI Engineer

---

## My Background
- Strong Java Core knowledge
- No web development experience
- No Spring Boot experience
- Learning AI/Web Engineering from scratch

## Concepts Learned

### Step 1 — Project Structure + Git
- **Git**: Version control tool. Like a save-history for your code.
  - `git init` = start tracking a folder
  - `.gitignore` = tell Git which files to never save (passwords, temp files)
  - `.env` file = stores secret config values (passwords, URLs). Never commit this.
  - `.env.example` = a safe template showing WHAT variables exist, without real values

### Tools & Environment

- [ ] What Docker is and why we use it
- [ ] What Docker Compose is
- [ ] What Git branching is
- [ ] What VS Code extensions help Python/JS dev

### Python Basics

- [x] Python syntax vs Java (indentation, no types by default, no semicolons)
- [x] Python virtual environments (venv) -- like Maven but for runtime isolation
- [x] pip -- Python's equivalent of Maven
- [x] Python type hints -- optional but we use them (like Java generics)
- [x] async/await in Python -- like CompletableFuture in Java
- [x] Pydantic -- data validation (like Java Bean Validation / @Valid)
- [x] Decorators (@app.get) -- like Java annotations (@GetMapping)

### Backend (FastAPI)

- [x] What FastAPI is -- like Spring Boot but Python
- [x] What Uvicorn is -- like Tomcat but for async Python
- [x] What CORS is and why browsers enforce it
- [x] REST API design (GET/POST/PUT/DELETE)
- [x] Dependency Injection in FastAPI -- like @Autowired in Spring
- [x] SQLAlchemy ORM -- like JPA/Hibernate in Java
- [x] Alembic migrations -- like Flyway/Liquibase in Java
- [ ] Background tasks -- like @Async in Spring
- [ ] SSE (Server-Sent Events) -- one-way streaming from server to browser

### Frontend (React)

- [ ] What React is -- component-based UI (no Java equivalent)
- [ ] What TypeScript is -- JavaScript with types (like Java but for the browser)
- [ ] What JSX/TSX is -- HTML inside JavaScript
- [ ] Props and State -- how components share data
- [ ] useEffect / useState hooks
- [ ] React Router -- client-side navigation
- [ ] React Query -- server state management (fetch + cache)
- [ ] Zustand -- global state (like a simple singleton store)
- [ ] Axios -- HTTP client (like Java's RestTemplate)
- [ ] TailwindCSS -- utility-first CSS
- [ ] shadcn/ui -- pre-built accessible components

### AI / RAG Concepts

- [ ] What an embedding is (turning text into numbers)
- [ ] What a vector database is (searching by meaning, not keywords)
- [ ] What RAG is (Retrieval-Augmented Generation)
- [ ] What chunking is and why it matters
- [ ] What a prompt template is
- [ ] What streaming LLM responses are (SSE/tokens)
- [ ] What a context window is

### Databases

- [x] PostgreSQL basics -- tables, foreign keys, queries
- [x] SQL basics -- SELECT, INSERT, UPDATE, DELETE
- [x] What an ORM is (Object-Relational Mapper)
- [ ] ChromaDB -- vector database concepts
- [ ] Why we use 2 databases (PostgreSQL + ChromaDB) for different purposes

### Tools Understood
- **PowerShell vs CMD**: Windows has two terminals. PowerShell uses different commands.
  - CMD: `copy`, `type`, `del`
  - PowerShell: `Copy-Item`, `Get-Content`, `Remove-Item`
- **Virtual Environment (venv)**: Isolated Python package space per project.
  - Like having separate classpaths per Java project.
  - Activate with: `venv\Scripts\activate`

---

## Steps Completed

| Step | Name                                | Date    | Key Concepts Learned                         |
| ---- | ----------------------------------- | ------- | -------------------------------------------- |
| --   | Environment Setup                   | 2025-07 | Docker Desktop, VS Code extensions           |
| 1    | Project Scaffold & Folder Structure | 2025-07 | .gitignore, .env files, git init, git commit |
| 2    | Backend: FastAPI Skeleton           | 2025-07 | FastAPI, Uvicorn, CORS, Pydantic, venv, pip  |
| 3    | Backend: Database Setup             | 2025-07 | SQLAlchemy, Alembic, PostgreSQL, ORM models  |
| 4    | Embedding Service Skeleton          |         |                                              |
| 5    | Docker: Containerize Services       |         |                                              |
| 6    | Docker Compose: Full Stack          |         |                                              |
| 7    | Frontend: React Scaffold            |         |                                              |
| 8    | Frontend: Connect to Backend        |         |                                              |
| 9    | Workspace CRUD API                  |         |                                              |
| 10   | Workspace UI (Dashboard)            |         |                                              |
| 11   | Document Upload API                 |         |                                              |
| 12   | Document Parsers                    |         |                                              |
| 13   | Embedding Pipeline                  |         |                                              |
| 14   | Document Management UI              |         |                                              |
| 15   | Settings API                        |         |                                              |
| 16   | Model List API                      |         |                                              |
| 17   | Settings UI                         |         |                                              |
| 18   | Model Selector Component            |         |                                              |
| 19   | RAG Pipeline                        |         |                                              |
| 20   | Chat API (SSE Streaming)            |         |                                              |
| 21   | Chat UI                             |         |                                              |
| 22   | Generator API                       |         |                                              |
| 23   | Generator UI                        |         |                                              |
| 24   | Error Handling                      |         |                                              |
| 25   | UX Polish                           |         |                                              |
| 26   | Backend Tests                       |         |                                              |
| 27   | End-to-End Smoke Test               |         |                                              |

## Questions / Things To Revisit
- How does Docker networking work? (localhost vs container hostnames)
- What is pg_hba.conf in PostgreSQL?

---

## Vocabulary Glossary

| Term           | Plain English Explanation                                              | Java Equivalent          |
| -------------- | ---------------------------------------------------------------------- | ------------------------ |
| pip            | Package manager for Python                                             | Maven / Gradle           |
| venv           | Isolated Python environment per project                                | Maven project scope      |
| FastAPI        | Web framework for building APIs in Python                              | Spring Boot              |
| Uvicorn        | Server that runs FastAPI apps                                          | Tomcat / Jetty           |
| Pydantic       | Library for data validation using Python type hints                    | Bean Validation (@Valid) |
| SQLAlchemy     | ORM for Python -- maps Python classes to DB tables                     | JPA / Hibernate          |
| Alembic        | Database migration tool for SQLAlchemy                                 | Flyway / Liquibase       |
| React          | JavaScript library for building UIs with reusable components           | No direct equivalent     |
| TypeScript     | JavaScript with static types                                           | Java (typed language)    |
| npm            | Package manager for JavaScript/TypeScript                              | Maven / Gradle           |
| Axios          | HTTP client library for JavaScript                                     | RestTemplate / OkHttp    |
| React Query    | Library to fetch, cache, and sync server data in React                 | No direct equivalent     |
| Zustand        | Tiny global state manager for React                                    | Singleton service bean   |
| TailwindCSS    | CSS framework using utility classes directly in HTML                   | No equivalent            |
| Docker         | Packages app + dependencies into a portable container                  | JAR but for everything   |
| Docker Compose | Tool to run multiple Docker containers together                        | No equivalent            |
| SSE            | Server-Sent Events -- server pushes data to browser over HTTP          | No direct equivalent     |
| RAG            | Retrieval-Augmented Generation -- give LLM relevant docs as context    | No equivalent            |
| Embedding      | Converting text to a list of numbers that capture meaning              | No equivalent            |
| Vector DB      | Database that searches by meaning/similarity instead of exact match    | No equivalent            |
| ChromaDB       | Local vector database we use to store document embeddings              | No equivalent            |
| LLM            | Large Language Model -- the AI that generates text (Claude, GPT, etc.) | No equivalent            |

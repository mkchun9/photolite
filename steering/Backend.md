---
inclusion: fileMatch
fileMatchPattern: "backend/**"
---

# Backend Development Guidelines

This document summarizes key backend design principles and rules, showcasing recommended patterns. Follow these guidelines when writing backend code.

## 개발환경
- **Node.js:** 사용가능한 최신 LTS
- **Nest.js:** https://docs.nestjs.com/
- **패키지 매니저:** **pnpm**
- **Docker**
- **Redis (Optional)**
- **PostgreSQL (Optional)**
- **RabbitMQ (Optional)**

- 알려진 보안 취약점(CVE)이 있는 버전은 절대 사용하지 않으며, 보안 패치가 적용된 최신 안정 버전을 사용한다.
- 프로젝트 시작 전 및 정기적으로 pnpm audit 명령어로 보안 취약점을 점검한다.

## Readability

### Naming Magic Numbers
**Rule:** Replace unexplained numeric literals with named constants.
**Reasoning:**
- Gives semantic meaning to values.
- Simplifies updates and reduces duplication.

```typescript
// Bad
const timeout = 5000;

// Good
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
await axios.get(url, { timeout: DEFAULT_REQUEST_TIMEOUT_MS });
```

### Clear Function Structure
**Rule:** Each function or method should have a single responsibility and avoid deep nesting.
**Reasoning:**
- Enhances readability and testability.
- Makes debugging easier by isolating concerns.

```typescript
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.userService.createUser(dto);
  }
}

@Injectable()
export class UserService {
  constructor(private readonly repo: UserRepository) {}

  async createUser(dto: CreateUserDto) {
    this.validate(dto);
    return this.repo.save(dto);
  }

  private validate(dto: CreateUserDto) {
    // validation logic
  }
}
```

---

## Abstraction

### Module-Based Architecture
**Rule:** Separate features into modules (e.g. `user.module.ts`, `auth.module.ts`).
**Reasoning:**
- Improves maintainability.
- Enables future extraction into microservices.

```
src/
├── modules/
│   └── user/
│       ├── user.controller.ts
│       ├── user.service.ts
│       ├── user.repository.ts
│       └── user.module.ts
├── common/
│   ├── filters/
│   ├── interceptors/
│   └── utils/
├── config/
└── main.ts
```

### Abstracting Implementation Details
**Rule:** Delegate complex logic to services, utilities, or helpers.
**Reasoning:**
- Keeps controllers thin.
- Encourages reuse and easier maintenance.

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(ctx: ExecutionContext) {
    const token = extractToken(ctx);
    return this.authService.verifyToken(token);
  }
}
```

---

## Predictability

### Resource-Oriented API Design
**Rule:** Use RESTful, resource-centered endpoints with versioning.
**Reasoning:**
- Provides a predictable structure.
- Aligns with HTTP method semantics.

```
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/:id
PUT    /api/v1/users/:id
DELETE /api/v1/users/:id
```

### Standardizing Return Types
**Rule:** Controllers should return DTOs or a unified response shape; handle errors via exception filters.
**Reasoning:**
- Ensures clients can parse responses and errors consistently.

```typescript
// ResponseInterceptor applies this format
{
  success: true,
  data: { /* ... */ },
  error: null
}
```

---

## Cohesion

### Organizing Code by Feature/Domain
**Rule:** Group files by domain: `modules/`, `common/`, `config/`, `middlewares/`, etc.
**Reasoning:**
- Collocates related code for easier navigation and maintenance.

```
src/
├── modules/
│   └── user/
│       ├── user.controller.ts
│       ├── user.service.ts
│       ├── user.repository.ts
│       └── user.module.ts
├── common/
│   ├── filters/
│   ├── interceptors/
│   └── utils/
├── config/
│   └── orm.config.ts
└── main.ts
```

---

## Coupling

### Dependency Injection & DIP
**Rule:** Depend on abstractions (interfaces) rather than concrete implementations.
**Reasoning:**
- Lowers coupling and simplifies testing with mocks.

```typescript
export interface IUserRepository {
  findById(id: number): Promise<User>;
}

@Injectable()
export class UserService {
  constructor(@Inject('IUserRepository') private readonly repo: IUserRepository) {}
}
```

### Avoiding Premature Abstraction
**Rule:** Only abstract duplicate logic that is proven stable.
**Reasoning:**
- Prevents forcing divergent use cases into one abstraction.

> Consider stability and similarity before creating shared utilities.

---

## Security

### Environment Variable Management
**Rule:** Store secrets in `.env` and load via a config module.
**Reasoning:**
- Keeps sensitive data out of source control.

```bash
# .env.example
DATABASE_URL=postgres://user:pass@host:5432/db
JWT_SECRET=your_jwt_secret
```

### HTTP Security
**Rule:** Apply `helmet`, `cors`, and rate limiting.
**Reasoning:**
- Protects against common web vulnerabilities.

### Input Validation
**Rule:** Use `class-validator` and `class-transformer` on DTOs.
**Reasoning:**
- Prevents malformed data and injection attacks.

### Authentication & Authorization
**Rule:** Use JWT (`@nestjs/jwt`) and implement RBAC.
**Reasoning:**
- Ensures secure access control.

### Logging & Auditing
**Rule:** Centralize logs with `nestjs-winston`.
**Reasoning:**
- Simplifies monitoring and incident investigation.

---

## Testing & TDD

### Test Types
- Unit Tests: Jest
- Integration Tests: Supertest
- End-to-End Tests: Cypress

**Rule:** Write tests before implementation.
**Reasoning:**
- Drives design and catches regressions early.

```bash
npm run test       # unit + integration
npm run test:e2e   # end-to-end
```

---

## SOLID Principles

- **SRP (Single Responsibility):** One reason to change per class/module.
- **OCP (Open/Closed):** Extend without modifying existing code.
- **LSP (Liskov Substitution):** Subtypes must substitute base types.
- **ISP (Interface Segregation):** Clients shouldn't depend on unused methods.
- **DIP (Dependency Inversion):** Depend on abstractions, not concretions.

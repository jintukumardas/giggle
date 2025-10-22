# Contributing to Giggle

Thank you for your interest in contributing to Giggle! This document provides guidelines and instructions for contributing.

## 🤝 How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Screenshots/logs if applicable

### Suggesting Features

Feature requests are welcome! Please:
- Check existing issues first
- Describe the feature clearly
- Explain the use case
- Consider implementation complexity

### Pull Requests

1. **Fork the repository**

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the code style (Prettier/ESLint)
   - Add tests if applicable
   - Update documentation

4. **Test your changes**
   ```bash
   pnpm install
   pnpm typecheck
   pnpm lint
   pnpm test
   ```

5. **Commit with clear messages**
   ```bash
   git commit -m "feat: add natural language date parsing"
   ```

   Use conventional commits:
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation
   - `style:` Formatting
   - `refactor:` Code restructuring
   - `test:` Tests
   - `chore:` Maintenance

6. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

   Then open a PR on GitHub with:
   - Clear title and description
   - Link to related issues
   - Screenshots/demos if applicable

## 📁 Project Structure

```
giggle/
├── apps/
│   └── api/              # Main Express server
│       ├── src/
│       │   ├── routes/   # HTTP route handlers
│       │   ├── services/ # Business logic
│       │   ├── db/       # Database schema
│       │   ├── utils/    # Utilities
│       │   └── types/    # TypeScript types
│       └── scripts/      # Build/migration scripts
│
├── packages/
│   ├── agents/           # ASI Alliance agent
│   ├── crypto/           # (future) Crypto utilities
│   └── shared/           # (future) Shared types
│
└── docs/                 # (future) Documentation
```

## 🎨 Code Style

We use Prettier and ESLint for consistent code style.

### Auto-format on save

**VS Code:**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

### Manual formatting

```bash
pnpm format
```

## 🧪 Testing

### Run all tests

```bash
pnpm test
```

### Run specific test

```bash
cd apps/api
pnpm test -- parser.test.ts
```

### Test coverage

```bash
pnpm test -- --coverage
```

## 📝 Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Update SETUP.md for setup process changes
- Create docs/ pages for complex features

## 🔒 Security

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

Instead:
1. Email: security@giggle.example.com
2. Include detailed description
3. Wait for response before disclosure

### Security Best Practices

- Never commit secrets (.env files)
- Use environment variables
- Validate all user inputs
- Sanitize data before database operations
- Use HTTPS in production
- Enable Twilio signature verification

## 🏗️ Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Run database migrations
cd apps/api
pnpm tsx scripts/migrate.ts

# Start all services
pnpm dev
```

### Adding Dependencies

```bash
# Add to root
pnpm add -w <package>

# Add to specific workspace
pnpm add --filter api <package>
```

### Creating a New Service

1. Create file in `apps/api/src/services/`
2. Export a class with methods
3. Create singleton instance
4. Export the instance

Example:
```typescript
// apps/api/src/services/example.service.ts
export class ExampleService {
  async doSomething(): Promise<void> {
    // Implementation
  }
}

export const exampleService = new ExampleService();
```

### Adding a New Route

1. Create file in `apps/api/src/routes/`
2. Use Express Router
3. Add to `apps/api/src/index.ts`

Example:
```typescript
// apps/api/src/routes/example.route.ts
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Example' });
});

export default router;
```

### Database Changes

1. Update schema in `apps/api/src/db/schema.ts`
2. Update migration in `apps/api/scripts/migrate.ts`
3. Test migration on fresh database

## 🚀 Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes

### Creating a Release

1. Update version in package.json
2. Update CHANGELOG.md
3. Commit: `git commit -m "chore: release v1.2.3"`
4. Tag: `git tag v1.2.3`
5. Push: `git push origin main --tags`

## 📋 Checklist for Major Contributions

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] No new warnings
- [ ] Changelog updated (if applicable)

## 🎯 Good First Issues

Look for issues labeled:
- `good first issue`
- `help wanted`
- `documentation`

These are great starting points!

## 💬 Communication

- **GitHub Issues:** Bug reports, feature requests
- **GitHub Discussions:** Questions, ideas
- **Discord:** (Coming soon) Real-time chat

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be:
- Listed in README.md
- Mentioned in release notes
- Given credit in commit history

Thank you for making Giggle better! 🚀

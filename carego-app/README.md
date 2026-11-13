# CareGo+

Home-healthcare marketplace for Bangladesh (Angular 22). Customers book caregivers, nurses and nannies; admins confirm and assign; caregivers run shifts and get paid. See [documents/carego.md](documents/carego.md) for the business rules.

## Run

```bash
npm install
npm start            # http://localhost:4200
npm run build        # production build to dist/
```

## Demo accounts (password `demo1234`)

| Role | Login |
|---|---|
| Customer | `customer@carego.demo` |
| Caregiver | `caregiver@carego.demo` |
| Admin | `admin@carego.demo` |

Data lives in the browser's `localStorage`; clear it to reset the demo.

## Tests

```bash
npm run test:engine   # business-rule tests
npm run build:dev && npm run e2e:smoke && npm run e2e:flow   # real-Chrome tests, see e2e/README.md
```

## Layout

- `src/app/core/domain/` — pure business engine and seed data
- `src/app/core/` — store, auth, guards, wizard state
- `src/app/layouts/` — public, customer, caregiver and admin shells
- `src/app/pages/` — routed pages
- `public/assets/img/` — local images

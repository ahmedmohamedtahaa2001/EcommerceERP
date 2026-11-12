# AI Model Implementation Prompt

## Reverse Engineer & Build Operix.co Clone with Next.js + Supabase

**This prompt is designed for Claude or other AI models with unlimited tokens**

---

## Context

You are an expert full-stack developer with deep expertise in:

- Next.js 14+ with TypeScript
- Tailwind CSS design systems
- Supabase database architecture
- React component development
- Responsive web design
- Modern web development best practices

Your task is to reverse engineer the operix.co/new-landing page and build a high-quality Next.js clone that can be used as a free alternative for business purposes.

---

## Analysis Data Files

The following files contain detailed reverse engineering data collected via Playwright MCP and REA analysis. Use these as your primary reference:

### Critical Files to Review First

1. **`analysis/dom-structure.json`** - Complete DOM tree and component hierarchy
2. **`analysis/design-tokens.json`** - Colors, fonts, spacing, and design system
3. **`analysis/api-endpoints.json`** - API calls and backend endpoints discovered
4. **`analysis/forms-analysis.json`** - Form structures and field definitions
5. **`analysis/visual-analysis.json`** - Visual breakpoints and styling analysis

### Supporting Files

6. **`analysis/dom-summary.json`** - Summary of page structure
7. **`analysis/visual-summary.json`** - Visual design summary
8. **`analysis/api-summary.json`** - API summary
9. **`analysis/forms-summary.json`** - Forms summary
10. **`analysis/screenshots/`** - Screenshots at mobile/tablet/desktop

---

## Project Requirements

### Technology Stack (Non-negotiable)

- **Framework:** Next.js 14 with TypeScript (strict mode)
- **Styling:** Tailwind CSS v3+
- **Database:** Supabase PostgreSQL
- **UI Components:** shadcn/ui components (optional but recommended)
- **Form Handling:** React Hook Form + Zod validation
- **Deployment:** Vercel (built-in Next.js optimization)

### Project Structure

Create this exact structure:

```
operix-clone/
├── app/
│   ├── api/
│   │   ├── contact/route.ts
│   │   ├── newsletter/route.ts
│   │   ├── demo/route.ts
│   │   └── health/route.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Navigation.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── MobileMenu.tsx
│   │   ├── sections/
│   │   │   ├── HeroSection.tsx
│   │   │   ├── FeaturesSection.tsx
│   │   │   ├── BenefitsSection.tsx
│   │   │   ├── PricingSection.tsx
│   │   │   ├── TestimonialsSection.tsx
│   │   │   └── CTASection.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Form.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Badge.tsx
│   │   ├── forms/
│   │   │   ├── ContactForm.tsx
│   │   │   ├── NewsletterForm.tsx
│   │   │   └── DemoRequestForm.tsx
│   │   └── common/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── Toast.tsx
│   ├── layout.tsx (root layout with metadata)
│   ├── page.tsx (landing page)
│   ├── globals.css
│   └── sitemap.ts
├── lib/
│   ├── supabase.ts (Supabase client)
│   ├── constants.ts (colors, breakpoints, etc.)
│   ├── utils.ts (helper functions)
│   ├── types.ts (TypeScript interfaces)
│   └── validations.ts (Zod schemas)
├── hooks/
│   ├── useViewport.ts
│   ├── useScrollPosition.ts
│   └── useForm.ts (custom form hook)
├── styles/
│   └── globals.css
├── public/
│   ├── images/
│   ├── icons/
│   └── fonts/
├── .env.example
├── next.config.js
├── tsconfig.json
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## Design System Implementation

### Color System

Extract from `design-tokens.json` and implement as:

```typescript
// lib/constants.ts
export const colors = {
  primary: {
    50: "#...",
    100: "#...",
    // ... 900
  },
  secondary: {/* ... */},
  neutral: {/* ... */},
  success: {/* ... */},
  error: {/* ... */},
  warning: {/* ... */},
  info: {/* ... */},
};

export const colorMap = {
  "bg-primary": colors.primary[600],
  "text-primary": colors.primary[900],
  // ... map all colors
};
```

### Typography System

```typescript
// lib/constants.ts
export const fonts = {
  display: "font-display", // Large headings
  body: "font-body", // Body text
  mono: "font-mono", // Code
};

export const fontSizes = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
  "5xl": "3rem",
  "6xl": "3.75rem",
};
```

### Spacing Scale

Implement consistent 8px base unit spacing throughout.

---

## Component Specifications

### Layout Components

#### Header Component

```typescript
// app/components/layout/Header.tsx
- Logo (clickable, links to home)
- Navigation menu (horizontal desktop, hidden mobile)
- Mobile menu toggle button
- CTA button(s)
- Sticky header behavior
- Responsive navigation
```

**Requirements:**

- Mobile menu overlay with smooth animations
- Active link indication
- Dark mode toggle (optional but nice)
- Fixed/sticky positioning when scrolling

#### Navigation Component

```typescript
- Links to main sections
- Smooth scroll anchors
- Active state tracking
- Mobile-optimized touch targets (48px minimum)
```

#### Footer Component

```typescript
- Company information
- Links grouped by category
- Newsletter signup form (integrated)
- Social media icons
- Copyright notice
- Privacy/Terms links
```

---

## Section Components

### HeroSection

**Characteristics:**

- Full viewport height (or 80vh minimum)
- Prominent headline + subheading
- Call-to-action button(s)
- Background image/video
- Optional floating elements or animations

```typescript
interface HeroSectionProps {
  headline: string;
  subheading: string;
  ctaText: string;
  ctaLink: string;
  backgroundImage?: string;
  backgroundVideo?: string;
}
```

### Feature Cards Section

- Grid layout (3 columns desktop, 2 tablet, 1 mobile)
- Icon + Title + Description
- Hover animations
- Optional link/CTA

```typescript
interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  link?: string;
}
```

### Pricing Section (if present)

- Multiple tier cards
- Feature comparison
- CTA per tier
- Popular tier highlight

### Call-to-Action Section

- Large headline
- Prominent button
- Optional form element
- Full-width or contained layout

---

## Form Components & Validation

### ContactForm

```typescript
interface ContactFormData {
  name: string;
  email: string;
  company?: string;
  message: string;
  phone?: string;
}

// Validation schema (Zod)
const contactFormSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  company: z.string().optional(),
  message: z.string().min(10).max(5000),
  phone: z.string().optional(),
});
```

### NewsletterForm

```typescript
interface NewsletterFormData {
  email: string;
}

const newsletterSchema = z.object({
  email: z.string().email("Invalid email address"),
});
```

### DemoRequestForm

```typescript
interface DemoRequestData {
  name: string;
  email: string;
  company: string;
  useCase: string;
  preferredTime?: string;
}
```

---

## API Routes

### POST /api/contact

```typescript
// Body: ContactFormData
// Response: { success: boolean; message: string; id?: string }
// Actions:
//   1. Validate input with Zod
//   2. Save to Supabase 'contacts' table
//   3. Send confirmation email
//   4. Return success/error response
```

### POST /api/newsletter

```typescript
// Body: { email: string }
// Response: { success: boolean; message: string }
// Actions:
//   1. Validate email
//   2. Check if already subscribed
//   3. Add to Supabase 'newsletter_subscribers' table
//   4. Send welcome email
```

### POST /api/demo

```typescript
// Body: DemoRequestData
// Response: { success: boolean; message: string; scheduledAt?: string }
// Actions:
//   1. Validate input
//   2. Save to Supabase 'demo_requests' table
//   3. Send confirmation email to user
//   4. Send notification to admin
```

### GET /api/health

```typescript
// Simple health check endpoint
// Response: { status: 'ok'; timestamp: string }
// Used for monitoring
```

---

## Database Schema (Supabase)

### contacts table

```sql
CREATE TABLE public.contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  message TEXT NOT NULL,
  phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'new', -- new, read, replied
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_created_at ON contacts(created_at DESC);
```

### newsletter_subscribers table

```sql
CREATE TABLE public.newsletter_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  source VARCHAR(100), -- website, referral, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX idx_newsletter_is_active ON newsletter_subscribers(is_active);
```

### demo_requests table

```sql
CREATE TABLE public.demo_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  use_case TEXT,
  preferred_time VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending', -- pending, scheduled, completed, cancelled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_demo_requests_email ON demo_requests(email);
CREATE INDEX idx_demo_requests_status ON demo_requests(status);
```

### analytics_events table (optional)

```sql
CREATE TABLE public.analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name VARCHAR(100) NOT NULL,
  page_path VARCHAR(255),
  user_id VARCHAR(255),
  properties JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at DESC);
```

---

## Development Guidelines

### Code Quality

1. **TypeScript:** Strict mode enabled, no `any` types
2. **Components:** Functional components with proper prop typing
3. **Hooks:** Use built-in and custom hooks appropriately
4. **Error Handling:** Try-catch blocks with proper error messages
5. **Accessibility:** ARIA labels, semantic HTML, keyboard navigation

### Performance

1. **Image Optimization:**

   ```typescript
   import Image from "next/image";
   // Use Next.js Image component for all images
   ```

2. **Code Splitting:**

   ```typescript
   import dynamic from "next/dynamic";
   // Lazy load heavy components
   const HeavyComponent = dynamic(() => import("./Heavy"));
   ```

3. **Server Components:**
   - Use Server Components for data fetching
   - Keep Client Components minimal

4. **Caching:**
   - Static generation for landing page
   - ISR if content updates
   - Client-side query caching

### Styling

1. **Tailwind Classes:**
   - Use consistent naming
   - Leverage utility classes
   - Create component classes sparingly
   - Use CSS modules only when needed

2. **Responsive Design:**

   ```typescript
   // Mobile-first approach
   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
   ```

3. **Dark Mode:**
   - Implement with Tailwind dark mode
   - Use `dark:` prefix classes
   - Respect system preference

### Testing

Generate test files for critical components:

```typescript
// app/components/Button.test.tsx
import { render, screen } from '@testing-library/react';
import Button from './Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

---

## Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email Service (SendGrid or Resend)
SENDGRID_API_KEY=your-sendgrid-key
# OR
RESEND_API_KEY=your-resend-key

# Analytics (optional)
NEXT_PUBLIC_GA_ID=UA-XXXXXXXXX-X

# Environment
NODE_ENV=production
```

---

## Implementation Checklist

### Phase 1: Foundation ✓

- [ ] Create Next.js project with TypeScript
- [ ] Set up Tailwind CSS configuration
- [ ] Configure tsconfig.json (strict mode)
- [ ] Set up environment variables
- [ ] Create lib/constants.ts with design tokens
- [ ] Set up Supabase project and RLS policies

### Phase 2: Components ✓

- [ ] Build Header component with mobile menu
- [ ] Build Footer component
- [ ] Create reusable Button component
- [ ] Create reusable Card component
- [ ] Create Form components with validation
- [ ] Build all section components

### Phase 3: Pages & Routing ✓

- [ ] Create root layout with metadata
- [ ] Build landing page (page.tsx)
- [ ] Add 404 page (not-found.tsx)
- [ ] Configure sitemap.ts

### Phase 4: API Routes ✓

- [ ] Implement /api/contact route
- [ ] Implement /api/newsletter route
- [ ] Implement /api/demo route
- [ ] Add error handling and validation
- [ ] Set up Supabase inserts

### Phase 5: Features ✓

- [ ] Form submission and email notifications
- [ ] Database persistence
- [ ] Success/error messages
- [ ] Loading states
- [ ] Analytics tracking (optional)

### Phase 6: Polish ✓

- [ ] Responsive design across breakpoints
- [ ] Accessibility audit (axe, WAVE)
- [ ] Performance optimization (Lighthouse)
- [ ] SEO optimization (meta tags, structured data)
- [ ] Cross-browser testing

### Phase 7: Deployment ✓

- [ ] Build test (`npm run build`)
- [ ] Deploy to Vercel
- [ ] Set up environment variables on Vercel
- [ ] Configure custom domain (optional)
- [ ] Enable analytics

---

## File Generation Priority

Generate in this order:

1. **Configuration Files**
   - `next.config.js`
   - `tailwind.config.ts`
   - `tsconfig.json`

2. **Utility & Type Files**
   - `lib/types.ts`
   - `lib/constants.ts`
   - `lib/utils.ts`
   - `lib/validations.ts`

3. **Layout Components**
   - `app/layout.tsx`
   - `app/components/layout/Header.tsx`
   - `app/components/layout/Footer.tsx`

4. **UI Components**
   - `app/components/ui/Button.tsx`
   - `app/components/ui/Card.tsx`
   - `app/components/ui/Input.tsx`
   - `app/components/ui/Form.tsx`

5. **Section Components**
   - `app/components/sections/HeroSection.tsx`
   - `app/components/sections/FeaturesSection.tsx`
   - Other sections

6. **Form Components**
   - `app/components/forms/ContactForm.tsx`
   - `app/components/forms/NewsletterForm.tsx`

7. **API Routes**
   - `app/api/contact/route.ts`
   - `app/api/newsletter/route.ts`
   - `app/api/demo/route.ts`

8. **Pages**
   - `app/page.tsx`
   - `app/globals.css`

9. **Documentation**
   - `README.md`
   - `.env.example`

---

## Code Style & Conventions

### Naming Conventions

```typescript
// Components: PascalCase
interface ButtonProps {
  /* ... */
}
export const Button: React.FC<ButtonProps> = (props) => {};

// Functions: camelCase
export const formatDate = (date: Date) => {};

// Constants: UPPER_SNAKE_CASE
export const MAX_FORM_SIZE = 1024;

// Types: PascalCase
type User = { id: string; name: string };
interface Props {
  /* ... */
}
```

### Component Template

```typescript
'use client'; // Add if component uses hooks

import React from 'react';

interface Props {
  // Define all props with types
  title: string;
  onClick?: () => void;
}

export const MyComponent: React.FC<Props> = ({
  title,
  onClick
}) => {
  return (
    <div className="...">
      {title}
    </div>
  );
};

export default MyComponent;
```

---

## Success Criteria

Your implementation is successful when:

- [ ] All components render without TypeScript errors
- [ ] All styles match the target design (90%+ visual similarity)
- [ ] Forms submit data to Supabase correctly
- [ ] Fully responsive on mobile (375px), tablet (768px), desktop (1920px)
- [ ] Lighthouse scores: 90+ on all metrics
- [ ] No console errors or warnings
- [ ] Accessibility score 95+ (axe)
- [ ] All environment variables properly configured
- [ ] Ready for deployment to Vercel
- [ ] Database schema implemented and tested
- [ ] Email notifications working (if email service configured)

---

## Troubleshooting Guide

### Common Issues

**Issue:** "Cannot find module 'react'"

- Solution: Run `npm install`

**Issue:** TypeScript errors in components

- Solution: Check `tsconfig.json` is properly configured

**Issue:** Tailwind classes not applying

- Solution: Verify `tailwind.config.ts` includes all template paths

**Issue:** Supabase connection failing

- Solution: Check `NEXT_PUBLIC_SUPABASE_URL` and anon key are correct

**Issue:** Forms not submitting

- Solution: Verify API routes are creating correct table names in Supabase

**Issue:** Images not loading

- Solution: Use Next.js Image component and check `next.config.js` domains

---

## Performance Optimization Tips

1. **Image Optimization:**
   - Use WebP format
   - Implement responsive images with `srcSet`
   - Lazy load below-fold images

2. **Code Splitting:**
   - Lazy load sections below the fold
   - Code-split heavy libraries

3. **Data Fetching:**
   - Use Server Components for data
   - Cache static content with revalidateTime
   - Use SWR/React Query for client data

4. **Bundle Size:**
   - Analyze bundle with `next/bundle-analyzer`
   - Remove unused dependencies
   - Tree-shake unused code

---

## Before You Start

1. Carefully review all analysis files (JSON files in `analysis/` directory)
2. Study the design tokens - these are critical for consistency
3. Review the screenshots to understand the visual design
4. Understand the form structure and validation requirements
5. Plan the component hierarchy based on DOM structure
6. Create type definitions before writing components

---

## Questions to Ask If Unclear

1. Should we implement email notifications? (Requires SendGrid/Resend setup)
2. Should we track analytics? (Requires Google Analytics setup)
3. Should we implement dark mode? (Recommended for modern UX)
4. Should we add animations? (Recommended for user engagement)
5. Should we implement authentication? (Only if needed for business logic)

---

## Final Notes

- Write clean, maintainable code
- Add comments only for non-obvious logic
- Follow Next.js best practices
- Ensure all code is production-ready
- Test thoroughly before deployment
- Create comprehensive README for future developers

**You have unlimited tokens - use them to build this correctly and completely.**

Good luck! 🚀

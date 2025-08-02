This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Project overview

**Objectives (from challenge prompt):**
1. Show that learning can take place while users use AI for productivity tasks. "Does your prototype genuinely enhance learning rather than just supporting productivity?"
2. Prototype quickly and iterate. Don't ignore code quality, but it is not the primary focus
3. Demonstrate user empathy to learners and/or educators
4. Genuinely enhance learning. Don't just enable creativity
5. Use clear learning principles in the design of the app
6. Enhance human agency
7. Stay narrow and go deep, rather than going broad

**User Challenge:** When I am working with AI to produce a deliverable, I don't always feel I fully understand what thinking the AI did or why it did it the way it did. When I go to share this with my stakeholders (teachers, bosses, etc) I want to be confident I understand the work and will look good presenting it.

**Learning Opportunity**: A key challenge with embedding learning into a productivity task is motivation. Users have to *want* to learn in that moment. This user challenge presents an opportunity because they have to learn themselves in order to be able to represent the work to their stakeholders. We can use this to get them started

**Solution**: A system that helps a user prepare to present after having build a deliverable with AI. For this prototype, we will only focus on written work to make implementation easier. The system will first help the user think through who their stakeholders are and what they might ask. It will then help the learner study up to address their questions. Finally, it will give the user an opportunity to practice. The system will do this through a combination of AI agents instructed to do this guidance and a dedicated interface to show the user the process they are following.
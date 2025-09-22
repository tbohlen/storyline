/**
 * Header bar component that displays the application title and navigation
 * Uses shadcn/ui components for consistent styling
 */
export function HeaderBar() {
  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-semibold text-foreground">
              Storyline
            </h1>
          </div>
          <nav className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              Prepare to present your AI-created work
            </span>
          </nav>
        </div>
      </div>
    </header>
  );
}
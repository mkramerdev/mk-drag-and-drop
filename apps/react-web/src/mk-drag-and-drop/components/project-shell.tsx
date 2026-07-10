"use client"

import { useEffect, useState, type ReactNode } from "react"
import { NavBar } from "@/app/components/navigation/nav-bar"
import { MkDragAndDropAppSidebar } from "./app-sidebar"

export function MkDragAndDropProjectShell({
  children,
}: {
  children: ReactNode
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (!mobileSidebarOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileSidebarOpen(false)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [mobileSidebarOpen])

  return (
    <div className="min-h-screen w-full md:grid md:grid-cols-[18rem_minmax(0,1fr)]">
      <MkDragAndDropAppSidebar className="hidden md:block" />

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close project navigation"
            className="absolute inset-0 cursor-default bg-background/80"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <MkDragAndDropAppSidebar
            className="relative h-full w-72 border-r shadow-lg"
            onNavigate={() => setMobileSidebarOpen(false)}
          />
        </div>
      )}

      <section className="min-w-0">
        <header className="border-b border-border bg-background">
          <div className="px-4 py-3 md:px-8 md:py-4">
            <NavBar
              showAvatar={false}
              mobileLeadingSlot={
                <button
                  type="button"
                  aria-label="Open project navigation"
                  className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md border border-border bg-background text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 md:hidden"
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <span aria-hidden="true" className="flex flex-col gap-1">
                    <span className="block h-0.5 w-4 rounded-full bg-current" />
                    <span className="block h-0.5 w-4 rounded-full bg-current" />
                    <span className="block h-0.5 w-4 rounded-full bg-current" />
                  </span>
                </button>
              }
            />
          </div>
        </header>
        <div className="min-h-[calc(100vh-7rem)] px-4 py-6 md:px-8 lg:px-10">
          {children}
        </div>
      </section>
    </div>
  )
}

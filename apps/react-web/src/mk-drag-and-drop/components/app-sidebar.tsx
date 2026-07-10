"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@repo/shared"

type SidebarLink = {
  title: string
  href: string
}

type SidebarGroup = {
  title: string
  path: string
  href?: string
  items: SidebarLink[]
}

type DocsVersion = {
  label: string
  value: string
}

const projectBase = "/projects/mk-drag-and-drop"

const defaultDocsVersion: DocsVersion = { label: "v0.2.0", value: "0.2.0" }

const docsVersions: DocsVersion[] = [defaultDocsVersion]

const primaryItems: SidebarLink[] = [
  {
    title: "Overview",
    href: `${projectBase}/overview`,
  },
  {
    title: "Quickstart",
    href: `${projectBase}/quickstart`,
  },
]

const navigationGroups: SidebarGroup[] = [
  {
    title: "Concepts",
    path: `${projectBase}/concepts`,
    items: [
      { title: "Core concepts", href: `${projectBase}/concepts/core-concepts` },
      { title: "Lifecycle", href: `${projectBase}/concepts/lifecycle` },
      { title: "Overlays and modifiers", href: `${projectBase}/concepts/overlays-and-modifiers` },
      { title: "Sortable", href: `${projectBase}/concepts/sortable` },
      { title: "Targeting", href: `${projectBase}/concepts/targeting` },
    ],
  },
  {
    title: "DOM",
    path: `${projectBase}/dom`,
    items: [
      { title: "DOM API", href: `${projectBase}/dom/dom-api` },
      { title: "DOM sortable", href: `${projectBase}/dom/dom-sortable` },
    ],
  },
  {
    title: "React",
    path: `${projectBase}/react`,
    items: [
      { title: "React API", href: `${projectBase}/react/react-api` },
      { title: "React sortable", href: `${projectBase}/react/react-sortable` },
    ],
  },
  {
    title: "Examples",
    path: `${projectBase}/examples`,
    items: [
      { title: "Basic drag", href: `${projectBase}/examples/basic-drag` },
      { title: "Groups", href: `${projectBase}/examples/groups` },
      { title: "Kanban", href: `${projectBase}/examples/kanban` },
      { title: "Sortable list", href: `${projectBase}/examples/sortable-list` },
      { title: "Tree", href: `${projectBase}/examples/tree` },
    ],
  },
]

export function MkDragAndDropAppSidebar({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const [version, setVersion] = useState(defaultDocsVersion.value)

  return (
    <aside
      className={cn(
        "border-sidebar-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-screen md:border-r",
        className
      )}
    >
      <div className="flex h-full flex-col gap-4 px-3 py-4">
        <VersionSwitcher value={version} onValueChange={setVersion} />

        <nav className="min-h-0 flex-1 overflow-y-auto pr-1 text-sm">
          <div className="space-y-1">
            {primaryItems.map((item) => (
              <SidebarItem
                key={item.href}
                item={item}
                active={isActivePath(pathname, item.href)}
                onNavigate={onNavigate}
              />
            ))}
          </div>

          <div className="mt-4 space-y-1">
            {navigationGroups.map((group) => (
              <SidebarCollapsibleGroup
                key={group.path}
                group={group}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </nav>
      </div>
    </aside>
  )
}

function VersionSwitcher({
  value,
  onValueChange,
}: {
  value: string
  onValueChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedVersion = docsVersions.find((version) => version.value === value) ?? defaultDocsVersion

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="MK's Drag and Drop version"
        aria-expanded={open}
        className={cn(
          "flex h-12 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50",
          open && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <GalleryIcon />
        </span>
        <span className="min-w-0 flex flex-1 flex-col gap-0.5">
          <span className="truncate font-medium leading-5">MK's Drag and Drop</span>
          <span className="truncate text-xs leading-4 text-muted-foreground">
            {selectedVersion.label}
          </span>
        </span>
        <ChevronsIcon />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {docsVersions.map((version) => (
            <button
              key={version.value}
              type="button"
              className="flex w-full cursor-pointer items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
              onClick={() => {
                onValueChange(version.value)
                setOpen(false)
              }}
            >
              {version.label}
              {version.value === value && (
                <span className="ml-auto text-current">
                  <CheckIcon />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SidebarCollapsibleGroup({
  group,
  pathname,
  onNavigate,
}: {
  group: SidebarGroup
  pathname: string
  onNavigate?: () => void
}) {
  const sectionActive = isActivePath(pathname, group.path)
  const labelActive = group.href ? pathname === group.href : false
  const [open, setOpen] = useState(sectionActive)
  const expanded = open || sectionActive
  const labelClassName = cn(
    "min-w-0 flex-1 rounded-md px-2 py-2 text-left font-medium text-sidebar-foreground/75 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50",
    labelActive && "bg-sidebar-accent text-sidebar-accent-foreground"
  )

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        {group.href ? (
          <Link
            href={group.href}
            onClick={onNavigate}
            className={labelClassName}
          >
            {group.title}
          </Link>
        ) : (
          <button
            type="button"
            aria-expanded={expanded}
            className={cn(labelClassName, "cursor-pointer")}
            onClick={() => setOpen((current) => !current)}
          >
            {group.title}
          </button>
        )}
        <button
          type="button"
          aria-label={`${group.title} section`}
          aria-expanded={expanded}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-sidebar-foreground/70 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
          onClick={() => setOpen((current) => !current)}
        >
          <span aria-hidden="true" className="text-base leading-none">
            {expanded ? "-" : "+"}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="space-y-1 pl-3">
          {group.items.map((item) => (
            <SidebarItem
              key={item.href}
              item={item}
              active={isActivePath(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SidebarItem({
  item,
  active,
  onNavigate,
}: {
  item: SidebarLink
  active: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "block rounded-md px-2 py-2 text-sidebar-foreground/75 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50",
        active && "bg-sidebar-accent text-sidebar-accent-foreground"
      )}
    >
      {item.title}
    </Link>
  )
}

function isActivePath(pathname: string, href: string) {
  if (href === projectBase) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function GalleryIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M3 5h12v12H3z" />
      <path d="M7 9h12v12H7z" />
    </svg>
  )
}

function ChevronsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="ml-auto size-4 opacity-50"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="m20 6-11 11-5-5" />
    </svg>
  )
}

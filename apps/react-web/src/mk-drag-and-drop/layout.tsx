import type { ReactNode } from "react"
import { MkDragAndDropProjectShell } from "./components/project-shell"
import "./examples.css"

export default function MkDragAndDropLayout({
  children,
}: {
  children: ReactNode
}) {
  return <MkDragAndDropProjectShell>{children}</MkDragAndDropProjectShell>
}

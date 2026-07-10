import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CustomMDX } from "@/app/components/ui/mdx"
import { getProjectDoc, getProjectDocSlugs } from "../docs"
import { OverviewMoveCodeTabs } from "../components/overview-code-tabs"
import {
  BasicDragCodeTabs,
  BasicDragExampleTabs,
} from "../components/quickstart/basic-drag"
import {
  SingleDroppableCodeTabs,
  SingleDroppableExampleTabs,
} from "../components/quickstart/single-droppable"
import {
  DroppableContainerCodeTabs,
  DroppableContainerExampleTabs,
} from "../components/quickstart/droppable-container"
import {
  BasicDragLiveExampleTabs,
  GroupedLiveExampleTabs,
  KanbanLiveExampleTabs,
  SortableListLiveExampleTabs,
  TreeLiveExampleTabs,
} from "../components/example-pages"

type PageProps = {
  params: Promise<{
    slug: string[]
  }>
}

export function generateStaticParams() {
  return getProjectDocSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const doc = getProjectDoc(slug)

  if (!doc) return {}

  return {
    title: doc.metadata.title,
    description: doc.metadata.summary,
  }
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params
  const doc = getProjectDoc(slug)

  if (!doc) {
    notFound()
  }

  const isExamplePage = slug[0] === "examples"

  return (
    <article
      className={
        isExamplePage ? "prose mx-auto w-full max-w-6xl" : "prose mx-auto max-w-3xl"
      }
    >
      <CustomMDX
        source={doc.content}
        components={{
          OverviewMoveCodeTabs,
          BasicDragCodeTabs,
          BasicDragExampleTabs,
          SingleDroppableCodeTabs,
          SingleDroppableExampleTabs,
          DroppableContainerCodeTabs,
          DroppableContainerExampleTabs,
          BasicDragLiveExampleTabs,
          GroupedLiveExampleTabs,
          KanbanLiveExampleTabs,
          SortableListLiveExampleTabs,
          TreeLiveExampleTabs,
        }}
      />
    </article>
  )
}

import fs from "fs"
import path from "path"

export type ProjectDocMetadata = {
  title: string
  summary: string
}

export type ProjectDoc = {
  metadata: ProjectDocMetadata
  content: string
}

const docsDirectory = path.join(
  process.cwd(),
  "app",
  "projects",
  "mk-drag-and-drop"
)

function isValidDocSegment(segment: string) {
  return /^[a-z0-9-]+$/.test(segment)
}

function getDocSegments(docPath: string | string[]) {
  const segments = Array.isArray(docPath) ? docPath : docPath.split("/")

  if (
    segments.length === 0 ||
    segments.some((segment) => !isValidDocSegment(segment))
  ) {
    return null
  }

  return segments
}

function getProjectDocPath(docPath: string | string[]) {
  const segments = getDocSegments(docPath)
  if (!segments) return null

  const lastSegment = segments[segments.length - 1]

  const candidates = [
    path.join(docsDirectory, ...segments, `${lastSegment}.mdx`),
    path.join(docsDirectory, `${segments.join("/")}.mdx`),
  ]

  return candidates.find((filePath) => fs.existsSync(filePath)) ?? null
}

function parseProjectDocMdx(fileContent: string): ProjectDoc {
  const frontmatterRegex = /---\s*([\s\S]*?)\s*---/
  const match = frontmatterRegex.exec(fileContent)
  const frontmatterBlock = match?.[1]

  if (!frontmatterBlock) {
    throw new Error("Missing project doc MDX frontmatter block")
  }

  const content = fileContent.replace(frontmatterRegex, "").trim()
  const metadata: Partial<ProjectDocMetadata> = {}

  frontmatterBlock.trim().split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split(": ")
    if (!key) return

    let value = valueParts.join(": ").trim()
    value = value.replace(/^['"](.*)['"]$/, "$1")
    metadata[key.trim() as keyof ProjectDocMetadata] = value
  })

  if (!metadata.title || !metadata.summary) {
    throw new Error("Project doc MDX frontmatter requires title and summary")
  }

  return {
    metadata: metadata as ProjectDocMetadata,
    content,
  }
}

export function getProjectDoc(docPath: string | string[]) {
  const filePath = getProjectDocPath(docPath)
  if (!filePath) return null

  return parseProjectDocMdx(fs.readFileSync(filePath, "utf-8"))
}

export function getProjectDocSlugs(
  directory = docsDirectory,
  parentSegments: string[] = []
): string[][] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.name === "components") return []

      if (entry.isFile() && path.extname(entry.name) === ".mdx") {
        const basename = path.basename(entry.name, ".mdx")
        const lastParentSegment = parentSegments[parentSegments.length - 1]

        return [
          lastParentSegment === basename
            ? parentSegments
            : [...parentSegments, basename],
        ]
      }

      if (!entry.isDirectory() || !isValidDocSegment(entry.name)) {
        return []
      }

      return getProjectDocSlugs(path.join(directory, entry.name), [
        ...parentSegments,
        entry.name,
      ])
    })
}

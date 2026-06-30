import { DropzoneLineExample } from "./custom/dropzone-line/DropzoneLineExample";
import { SortableExample } from "./custom/sortable/SortableExample";

export function App(): JSX.Element {
  return (
    <main className="appShell">
      <div className="examplesLayout">
        <ExamplePanel title="Dropzone lines">
          <DropzoneLineExample />
        </ExamplePanel>
        <ExamplePanel title="Sortable list">
          <SortableExample />
        </ExamplePanel>
      </div>
    </main>
  );
}

function ExamplePanel(input: {
  title: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <section className="examplePanel">
      <h2 className="exampleTitle">{input.title}</h2>
      {input.children}
    </section>
  );
}

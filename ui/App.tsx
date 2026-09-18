// Empty variant-C layout: sidebar | (editor header / Blockly + ASM preview).
export function App() {
  return (
    <div className="app">
      <aside className="sidebar" aria-label="Block">
        <section className="props">
          <h1>BlockCreator</h1>
          <p className="placeholder">Block properties</p>
        </section>
        <section className="slots">
          <p className="placeholder">Slots</p>
        </section>
        <section className="save">
          <p className="placeholder">Save</p>
        </section>
      </aside>
      <main className="main">
        <header className="edhead">
          <span className="placeholder">No Slot selected</span>
        </header>
        <div className="split">
          <section className="editor" aria-label="Logic editor">
            <p className="placeholder">Blockly editor</p>
          </section>
          <section className="asm" aria-label="ASM preview">
            <pre>; ASM preview</pre>
          </section>
        </div>
      </main>
    </div>
  );
}

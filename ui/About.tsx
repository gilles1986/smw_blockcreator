import { useState } from 'react';
import { ExternalLink } from './ExternalLink';
import { InfoIcon } from './icons';
import { Modal } from './Modal';
import { ABOUT } from './aboutText';

/** The info button and the modal it opens: author, knowledge source and what the tool depends on. */
export function About({ version }: { version: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="icon-btn"
        title="About BlockCreator"
        aria-label="About BlockCreator"
        onClick={() => setOpen(true)}
      >
        <InfoIcon />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} titleId="about-title">
        <div className="modal-body about">
          <h2 id="about-title">BlockCreator {version}</h2>
          <p>{ABOUT.summary}</p>
          <dl className="about-facts">
            <dt>Author</dt>
            <dd>
              {ABOUT.author} ·{' '}
              <ExternalLink href={ABOUT.website.url}>{ABOUT.website.label}</ExternalLink>
            </dd>
            <dt>Knowledge source</dt>
            <dd>
              <ExternalLink href={ABOUT.knowledgeSource.url}>
                {ABOUT.knowledgeSource.label}
              </ExternalLink>
            </dd>
            <dt>Needs</dt>
            <dd>{ABOUT.needs}</dd>
            <dt>Built with</dt>
            <dd>{ABOUT.builtWith}</dd>
          </dl>
          <p className="about-notice">{ABOUT.notice}</p>
          <form method="dialog">
            <button type="submit">Close</button>
          </form>
        </div>
      </Modal>
    </>
  );
}

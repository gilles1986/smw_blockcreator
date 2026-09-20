import { useState } from 'react';
import { ExternalLink } from './ExternalLink';
import { InfoIcon } from './icons';
import { Modal } from './Modal';
import { ABOUT } from './aboutText';

export function AboutDialog({
  open,
  onClose,
  version,
}: {
  open: boolean;
  onClose: () => void;
  version: string;
}) {
  const displayVersion = version.startsWith('v') ? version : `v${version}`;
  return (
    <Modal open={open} onClose={onClose} titleId="about-title">
      <div className="modal-body about">
        <h2 id="about-title">BlockCreator {displayVersion}</h2>
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
  );
}

/** The info button and the modal it opens: author, knowledge source and what the tool depends on. */
export function About({ version }: { version: string }) {
  const [open, setOpen] = useState(false);
  const displayVersion = version.startsWith('v') ? version : `v${version}`;
  return (
    <>
      <button
        type="button"
        className="icon-btn"
        title={`About BlockCreator (${displayVersion})`}
        aria-label={`About BlockCreator (${displayVersion})`}
        onClick={() => setOpen(true)}
      >
        <InfoIcon />
      </button>
      <AboutDialog open={open} onClose={() => setOpen(false)} version={version} />
    </>
  );
}

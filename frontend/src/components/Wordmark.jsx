import { APP_NAME } from "../brand";

// The logo: a small play button next to the app name
export default function Wordmark({ href }) {
  const content = (
    <>
      <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="currentColor" />
        <path d="M12.5 9.5v13l11-6.5z" fill="var(--bg)" />
      </svg>
      <span className="wordmark-text">{APP_NAME}</span>
    </>
  );

  if (href) {
    return (
      <a className="wordmark" href={href}>
        {content}
      </a>
    );
  }
  return <div className="wordmark">{content}</div>;
}
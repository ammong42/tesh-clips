import type { ReactNode } from "react";
export type IconName =
  | "leaf"
  | "moon"
  | "brain"
  | "wallet"
  | "sparkles"
  | "bookmark"
  | "arrow"
  | "back"
  | "replay"
  | "play"
  | "external"
  | "check"
  | "heart"
  | "sun";
const paths: Record<IconName, ReactNode> = {
  leaf: (
    <>
      <path d="M5 15C5 7 19 3 19 3s3 15-6 17c-5 1-8-1-8-5Z" />
      <path d="m5 21 10-13" />
    </>
  ),
  moon: (
    <>
      <path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />
      <path d="M18 3v4m-2-2h4" />
    </>
  ),
  brain: (
    <>
      <path d="M12 5a3 3 0 0 0-5-2 4 4 0 0 0-3 6 4 4 0 0 0 0 7 4 4 0 0 0 5 5 3 3 0 0 0 3-3V5Zm0 0a3 3 0 0 1 5-2 4 4 0 0 1 3 6 4 4 0 0 1 0 7 4 4 0 0 1-5 5 3 3 0 0 1-3-3" />
      <path d="M7 8c3 0 3 4 0 4m10-4c-3 0-3 4 0 4M7 17h1m8 0h1" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 8V5a2 2 0 0 0-2-2L5 6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h15V8H5a2 2 0 0 1 0-4" />
      <path d="M16 12h5v5h-5a2 2 0 0 1 0-5Z" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
      <path d="M21 2v4m-2-2h4" />
    </>
  ),
  bookmark: <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-4-6 4Z" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  replay: (
    <>
      <path d="M3 10a9 9 0 1 1 1 8M3 3v7h7" />
      <path d="m10 8 6 4-6 4V8Z" />
    </>
  ),
  play: <path d="m9 4 12 8-12 8V4Z" />,
  external: (
    <>
      <path d="M14 3h7v7m0-7L10 14" />
      <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
    </>
  ),
};
export default function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={`icon ${className}`}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

import type { SVGProps } from "react";

export type OzlindIconName =
  | "ozl-mark" | "sym-insight" | "sym-research" | "sym-discovery" | "sym-creation"
  | "sym-conversation" | "sym-sources" | "sym-active" | "sym-thinking" | "sym-processing"
  | "sym-success" | "sym-warning" | "i-ai-chat" | "i-home" | "i-new-conversation"
  | "i-search" | "i-menu" | "i-settings" | "i-profile" | "i-history" | "i-back"
  | "i-forward" | "i-close" | "i-research" | "i-web-research" | "i-sources"
  | "i-image-generator" | "i-photo-editor" | "i-code-assistant" | "i-documents"
  | "i-voice-ai" | "i-send" | "i-attach" | "i-microphone" | "i-stop" | "i-error"
  | "i-information" | "i-copy" | "i-edit" | "i-regenerate" | "i-delete" | "i-more"
  | "i-expand" | "i-collapse" | "i-open-external" | "i-download" | "i-upload"
  | "i-clear" | "i-refresh" | "i-bookmark" | "i-share" | "i-plus" | "i-check"
  | "i-arrow-up" | "i-arrow-right" | "src-fallback";

type Props = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: OzlindIconName;
  size?: number;
  title?: string;
};

/** Renders Ozlind's own icon sprite so product icons stay visually consistent. */
export function OzlindIcon({ name, size = 18, title, className, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={name === "ozl-mark" ? "0 0 96 96" : name === "ozl-node" ? "0 0 10 10" : "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={className}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <use href={`/ozlind-icons.svg#${name}`} />
    </svg>
  );
}

import type { SVGProps } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AudioLines,
  Bookmark,
  Check,
  CircleAlert,
  CircleHelp,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  FlaskConical,
  Globe,
  History,
  House,
  Image,
  Info,
  LibraryBig,
  LogOut,
  Maximize2,
  Menu,
  MessageSquare,
  Mic,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  Share2,
  Square,
  SquarePen,
  Trash2,
  Upload,
  UserRound,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";

export type OzlindIconName =
  | "ozl-app-icon" | "ozl-mark" | "ozl-node" | "sym-insight" | "sym-research" | "sym-discovery" | "sym-creation"
  | "sym-conversation" | "sym-sources" | "sym-active" | "sym-thinking" | "sym-processing"
  | "sym-success" | "sym-warning" | "i-ai-chat" | "i-home" | "i-new-conversation"
  | "i-search" | "i-menu" | "i-settings" | "i-profile" | "i-history" | "i-back"
  | "i-forward" | "i-close" | "i-logout" | "i-research" | "i-web-research" | "i-sources"
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

/**
 * Uses Lucide's consistent, optically balanced outline icons for interface actions.
 * Ozlind's own sprite remains the source for the brand mark and product-specific symbols.
 */
const interfaceIcons: Partial<Record<OzlindIconName, LucideIcon>> = {
  "i-ai-chat": MessageSquare,
  "i-home": House,
  "i-new-conversation": SquarePen,
  "i-search": Search,
  "i-menu": Menu,
  "i-settings": Settings,
  "i-profile": UserRound,
  "i-history": History,
  "i-back": ArrowLeft,
  "i-forward": ArrowRight,
  "i-close": X,
  "i-logout": LogOut,
  "i-research": FlaskConical,
  "i-web-research": Globe,
  "i-sources": LibraryBig,
  "i-image-generator": Image,
  "i-photo-editor": WandSparkles,
  "i-code-assistant": Code2,
  "i-documents": FileText,
  "i-voice-ai": AudioLines,
  "i-send": Send,
  "i-attach": Paperclip,
  "i-microphone": Mic,
  "i-stop": Square,
  "i-error": CircleAlert,
  "i-information": Info,
  "i-copy": Copy,
  "i-edit": Pencil,
  "i-regenerate": RotateCcw,
  "i-delete": Trash2,
  "i-more": MoreHorizontal,
  "i-expand": Maximize2,
  "i-collapse": Minimize2,
  "i-open-external": ExternalLink,
  "i-download": ArrowDownToLine,
  "i-upload": Upload,
  "i-clear": X,
  "i-refresh": RefreshCw,
  "i-bookmark": Bookmark,
  "i-share": Share2,
  "i-plus": Plus,
  "i-check": Check,
  "i-arrow-up": ArrowUp,
  "i-arrow-right": ArrowRight,
  "src-fallback": CircleHelp,
};

export function OzlindIcon({ name, size = 18, title, className, ...props }: Props) {
  const InterfaceIcon = interfaceIcons[name];

  if (InterfaceIcon) {
    return (
      <InterfaceIcon
        width={size}
        height={size}
        strokeWidth={1.8}
        aria-hidden={title ? undefined : true}
        role={title ? "img" : undefined}
        className={className}
        focusable="false"
        {...props}
      >
        {title ? <title>{title}</title> : null}
      </InterfaceIcon>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={name === "ozl-app-icon" || name === "ozl-mark" ? "0 0 96 96" : name === "ozl-node" ? "0 0 10 10" : "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={className}
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <use href={`/ozlind-icons.svg#${name}`} />
    </svg>
  );
}

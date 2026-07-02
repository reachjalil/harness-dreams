import { AlertTriangle, Clipboard, RotateCcw } from "lucide-react";
import {
  Component,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
} from "react";

interface ErrorBoundaryProps {
  name: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, errorInfo });
  }

  private errorDetails(): string {
    const { error, errorInfo } = this.state;
    return [
      `Page: ${this.props.name}`,
      error ? `${error.name}: ${error.message}` : "Unknown error",
      error?.stack ?? "",
      errorInfo?.componentStack ?? "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <section className="page-error-boundary" role="alert">
        <div className="page-error-icon">
          <AlertTriangle size={20} aria-hidden="true" />
        </div>
        <div className="page-error-copy">
          <p className="eyebrow">Page error</p>
          <h2>{this.props.name} could not render</h2>
          <p>{this.state.error.message || "Unexpected renderer failure."}</p>
        </div>
        <div className="page-error-actions">
          <button
            type="button"
            className="secondary-button icon-text-button"
            onClick={() => {
              void navigator.clipboard?.writeText(this.errorDetails());
            }}
          >
            <Clipboard size={16} aria-hidden="true" />
            Copy error
          </button>
          <button
            type="button"
            className="primary-button icon-text-button"
            onClick={() => window.location.reload()}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Reload
          </button>
        </div>
      </section>
    );
  }
}

export function PageBoundary({
  name,
  children,
}: ErrorBoundaryProps): ReactElement {
  return (
    <ErrorBoundary key={name} name={name}>
      {children}
    </ErrorBoundary>
  );
}

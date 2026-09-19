import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[GlobalErrorBoundary caught an error]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || String(this.state.error || 'Unknown error');

      return (
        <div className="min-h-screen bg-[#FFF9F2] dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#161616] rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-950/40 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
              !
            </div>
            <h2 className="text-2xl font-bold font-['Outfit'] mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-['Inter']">
              The application encountered an unexpected issue while rendering this page.
            </p>

            <div className="bg-gray-50 dark:bg-[#202020] rounded-xl p-3 text-left mb-6 overflow-hidden">
              <p className="text-xs font-mono text-red-600 dark:text-red-400 break-words">
                {errorMsg}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-[#FFC700] hover:bg-[#e6b400] text-black font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

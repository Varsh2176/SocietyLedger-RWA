import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Button } from '../components/common/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 mb-4">
        <Compass size={32} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Page Not Found</h1>
      <p className="mt-2 text-xs text-slate-500 max-w-sm leading-relaxed">
        The governance view or ledger record you requested does not exist or has moved.
      </p>
      <div className="mt-6">
        <Link to="/">
          <Button variant="primary" size="md" icon={Home}>
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}

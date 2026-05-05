'use client';

import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: ReactNode;
}

export default function ModalPortal({ children }: ModalPortalProps) {
  // Only render on client side to avoid hydration issues
  if (typeof window === 'undefined') {
    return null;
  }

  return createPortal(
    children,
    document.body
  );
}

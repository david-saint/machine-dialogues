import React, { useEffect } from 'react';

interface ImageModalProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ src, alt, onClose }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className="modal-image" />
        <button className="modal-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(8px);
          cursor: zoom-out;
        }

        .modal-content {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
          cursor: default;
        }

        .modal-image {
          display: block;
          max-width: 100%;
          max-height: 90vh;
          object-fit: contain;
          border: 1px solid var(--border);
          box-shadow: 0 0 50px rgba(0, 0, 0, 0.5);
        }

        .modal-close {
          position: absolute;
          top: -40px;
          right: -40px;
          background: transparent;
          border: none;
          color: white;
          font-size: 2.5rem;
          cursor: pointer;
          line-height: 1;
          padding: 10px;
          transition: transform 0.2s;
        }

        .modal-close:hover {
          transform: scale(1.1);
          color: var(--accent-claude);
        }

        @media (max-width: 768px) {
          .modal-close {
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};

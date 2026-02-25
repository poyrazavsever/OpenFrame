'use client';

import { memo } from 'react';
import { Download, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface ImagePreviewDialogProps {
  previewImage: string | null;
  onClose: () => void;
}

export const ImagePreviewDialog = memo(function ImagePreviewDialog({
  previewImage,
  onClose,
}: ImagePreviewDialogProps) {
  return (
    <Dialog open={!!previewImage} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-none sm:max-w-none w-screen h-screen max-h-screen p-0 overflow-hidden bg-black/90 border-none shadow-none flex flex-col items-center justify-center rounded-none"
      >
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <div className="absolute top-4 right-4 flex gap-3 z-50">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full bg-black/40 hover:bg-black/80 border-white/20 text-white h-10 w-10 backdrop-blur-md transition-all shrink-0"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                if (!previewImage) return;
                const response = await fetch(previewImage);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = previewImage.split('/').pop() || 'attachment.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
              } catch (error) {
                console.error('Failed to download image:', error);
                toast.error('Failed to download image');
              }
            }}
          >
            <Download className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full bg-black/40 hover:bg-black/80 border-white/20 text-white h-10 w-10 backdrop-blur-md transition-all shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div
          className="relative w-full h-full flex items-center justify-center p-4 cursor-zoom-out"
          onClick={onClose}
        >
          {previewImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-[95vw] max-h-[90vh] object-contain rounded-md select-none cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

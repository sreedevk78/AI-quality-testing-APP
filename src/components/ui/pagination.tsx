"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({ currentPage, totalPages, onPageChange }: { currentPage: number, totalPages: number, onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-2 py-4 border-t border-border mt-4">
      <p className="text-sm text-muted-foreground">
        Page <span className="font-medium text-foreground">{currentPage}</span> of <span className="font-medium text-foreground">{totalPages}</span>
      </p>
      <div className="flex gap-2">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={() => onPageChange(currentPage - 1)} 
          disabled={currentPage <= 1}
        >
          <ChevronLeft size={16} /> Previous
        </Button>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={() => onPageChange(currentPage + 1)} 
          disabled={currentPage >= totalPages}
        >
          Next <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

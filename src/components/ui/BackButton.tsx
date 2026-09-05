"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
    className?: string;
    label?: string;
}

export function BackButton({ className, label = "Back" }: BackButtonProps) {
    const router = useRouter();

    return (
        <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className={cn("flex items-center gap-2 text-muted-foreground hover:text-white transition-colors", className)}
            leftIcon={<ArrowLeft size={16} />}
        >
            {label}
        </Button>
    );
}

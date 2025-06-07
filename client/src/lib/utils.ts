/**
 * Utility Functions
 * 
 * A collection of general utility functions used throughout the application.
 * These functions provide common functionality for data processing,
 * formatting, and other helper operations.
 * 
 * Key Features:
 * - Data formatting
 * - Type checking
 * - Common calculations
 * - Helper functions
 * 
 * Connections:
 * - Used across all components
 * - Shared functionality
 * 
 * Usage:
 * These utilities are used throughout the application
 * for common operations and data processing.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

import { z } from 'zod';

const password = z.string().min(8, 'Password must be at least 8 characters');
const whatsapp = z
  .string()
  .min(6, 'Enter a valid WhatsApp number')
  .regex(/^[+0-9 ()-]+$/, 'Only digits, spaces and + ( ) - allowed');

export const clientSignupSchema = z
  .object({
    full_name: z.string().min(2, 'Full name is required'),
    email: z.string().email('Enter a valid email'),
    whatsapp,
    country: z.string().min(2, 'Country is required'),
    password,
    confirm_password: z.string(),
    accept_terms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the terms and privacy policy' }),
    }),
    preferred_language: z.enum(['en', 'fr']).optional(),
    preferred_currency: z
      .enum(['MUR', 'EUR', 'USD', 'GBP', 'INR', 'ZAR', 'CHF', 'AED'])
      .optional(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export const providerSignupSchema = z
  .object({
    owner_full_name: z.string().min(2, 'Owner full name is required'),
    business_name: z.string().min(2, 'Business name is required'),
    business_email: z.string().email('Enter a valid business email'),
    whatsapp,
    category_slug: z.string().min(2, 'Select a business category'),
    location_slug: z.string().min(2, 'Select a business location'),
    brn: z.string().optional(),
    password,
    confirm_password: z.string(),
    accept_terms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the provider terms' }),
    }),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email'),
});

export const resetPasswordSchema = z
  .object({
    password,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export type ClientSignupInput = z.infer<typeof clientSignupSchema>;
export type ProviderSignupInput = z.infer<typeof providerSignupSchema>;

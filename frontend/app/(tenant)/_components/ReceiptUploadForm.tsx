// Receipt upload form rendered inside PaymentSubmissionModal. Builds FormData manually
// because useSubmitReceipt expects multipart/form-data for the file upload.
// Controller wraps the file input since RHF's register can't handle File objects natively.
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { useSubmitReceipt } from '@/lib/hooks';
import useTenantStore from '@/lib/store/useTenantStore';
import { receiptUploadFormSchema } from '@/lib/types';
import type { z } from 'zod';

type ReceiptUploadFormValues = z.infer<typeof receiptUploadFormSchema>;

interface ReceiptUploadFormProps {
  paymentId: string;
  onSuccess: () => void;
}

export function ReceiptUploadForm(props: ReceiptUploadFormProps) {
  const addNotification = useTenantStore((s) => s.addNotification);
  const { mutateAsync, isPending } = useSubmitReceipt();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReceiptUploadFormValues>({
    resolver: zodResolver(receiptUploadFormSchema),
    defaultValues: {
      paymentId: props.paymentId,
      notes: '',
    },
  });

  async function onValid(values: ReceiptUploadFormValues): Promise<void> {
    const formData = new FormData();
    formData.append('paymentId', values.paymentId);
    formData.append('receipt', values.receipt);
    if (values.notes) formData.append('notes', values.notes);

    try {
      await mutateAsync(formData);
      addNotification({
        type: 'success',
        message: 'Receipt submitted. Awaiting landlord confirmation.',
        duration: 5000,
      });
      props.onSuccess();
    } catch {
      // Modal stays open on failure — onSuccess is not called so the user can retry.
      addNotification({
        type: 'error',
        message: 'Could not submit receipt. Please try again.',
        duration: 6000,
      });
    }
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-5">
      <input type="hidden" {...register('paymentId')} />

      <Controller
        control={control}
        name="receipt"
        render={({ field, fieldState }) => (
          <div>
            <label
              htmlFor="receipt"
              className="block font-sans text-sm font-medium text-[#111111] dark:text-[#f0f6fc] mb-1"
            >
              Receipt (JPEG, PNG, or PDF, max 5MB)
            </label>
            <input
              id="receipt"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onBlur={field.onBlur}
              onChange={(e) => field.onChange(e.target.files?.[0])}
              className="block w-full font-sans text-sm text-[#111111] dark:text-[#f0f6fc]
                         file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
                         file:bg-[#275D2C] file:text-white file:font-sans file:text-sm
                         hover:file:bg-[#1f4a23]
                         dark:file:bg-[#3fb950] dark:file:text-[#0d1117]"
              aria-invalid={fieldState.error ? 'true' : 'false'}
              aria-describedby={fieldState.error ? 'receipt-error' : undefined}
            />
            {fieldState.error && (
              <p
                id="receipt-error"
                className="mt-1 text-sm font-sans text-[#931F1D] dark:text-[#f85149]"
              >
                {fieldState.error.message}
              </p>
            )}
          </div>
        )}
      />

      <Textarea
        label="Notes (optional)"
        {...register('notes')}
        error={errors.notes?.message}
        helperText="Up to 500 characters."
        rows={4}
      />

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="md" isLoading={isPending}>
          Submit receipt
        </Button>
      </div>
    </form>
  );
}

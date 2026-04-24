// Manual confirmation request form for cash payments. Unlike ReceiptUploadForm, this sends
// JSON (not FormData) since there's no file — useSubmitManualRequest handles the POST directly.
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { useSubmitManualRequest } from '@/lib/hooks';
import useTenantStore from '@/lib/store/useTenantStore';
import { manualRequestFormSchema } from '@/lib/types';
import type { z } from 'zod';

type ManualRequestFormValues = z.infer<typeof manualRequestFormSchema>;

interface ManualRequestFormProps {
  paymentId: string;
  onSuccess: () => void;
}

export function ManualRequestForm(props: ManualRequestFormProps) {
  const addNotification = useTenantStore((s) => s.addNotification);
  const { mutateAsync, isPending } = useSubmitManualRequest();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ManualRequestFormValues>({
    resolver: zodResolver(manualRequestFormSchema),
    defaultValues: {
      paymentId: props.paymentId,
      notes: '',
    },
  });

  async function onValid(values: ManualRequestFormValues): Promise<void> {
    try {
      await mutateAsync(values);
      addNotification({
        type: 'success',
        message: 'Manual confirmation request sent. Awaiting landlord response.',
        duration: 5000,
      });
      props.onSuccess();
    } catch {
      addNotification({
        type: 'error',
        message: 'Could not send request. Please try again.',
        duration: 6000,
      });
    }
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-5">
      <input type="hidden" {...register('paymentId')} />

      <p className="font-sans text-sm text-[#6b7280] dark:text-[#8b949e]">
        Use this form to request confirmation for a cash payment made directly to your landlord.
        Your landlord will confirm or reject the request.
      </p>

      <Textarea
        label="Payment details"
        {...register('notes')}
        error={errors.notes?.message}
        helperText="Describe the payment (date, amount, context). Required."
        rows={5}
      />

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="md" isLoading={isPending}>
          Send request
        </Button>
      </div>
    </form>
  );
}

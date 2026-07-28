import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

export const DynamicDisputeVerificationModal = dynamic(
  () => import("@/components/trade/DisputeVerificationModal"),
  {
    loading: () => <div className="h-48 animate-pulse rounded-lg bg-gray-800" />,
    ssr: false,
  },
);

export const DynamicDriverManifestForm = dynamic(
  () => import("@/components/ui/DriverManifestForm"),
  {
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-gray-800" />,
    ssr: false,
  },
);

export const DynamicVideoUploadCard = dynamic(
  () => import("@/components/ui/VideoUploadCard"),
  {
    loading: () => <div className="h-40 animate-pulse rounded-lg bg-gray-800" />,
    ssr: false,
  },
);

export const DynamicRepScoreRing = dynamic(
  () => import("@/components/ui/RepScoreRing"),
  {
    loading: () => <Skeleton className="h-32 w-32 rounded-full" />,
    ssr: false,
  },
);

interface ResourceIconProps {
  resourceType: string;
  className?: string;
}

const iconMapping: Record<string, string> = {
  Namespace: "ns.svg",
  Node: "node.svg",
  Pod: "pod.svg",
  Service: "svc.svg",
  Ingress: "ing.svg",
  Deployment: "deploy.svg",
  ReplicaSet: "rs.svg",
  DaemonSet: "ds.svg",
  StatefulSet: "sts.svg",
  ConfigMap: "cm.svg",
  Secret: "secret.svg",
  ServiceAccount: "sa.svg",
  EndpointSlice: "ep.svg",
  PersistentVolume: "pv.svg",
  PersistentVolumeClaim: "pvc.svg",
};

export default function ResourceIcon({
  resourceType,
  className = "w-6 h-6",
}: ResourceIconProps) {
  const iconFile = iconMapping[resourceType] || "pod.svg";

  return (
    <img
      src={`/k8s/${iconFile}`}
      alt={resourceType}
      className={className}
      style={{ filter: "brightness(1.25)" }}
    />
  );
}

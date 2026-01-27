// Resource types from backend
export interface ResourceData {
  resourceType: string;
  raw: any; // Full Kubernetes object
}

// Helper function to create resource ID
export const createResourceId = (
  resourceType: string,
  namespace: string | undefined,
  name: string,
): string => {
  return `${resourceType}:${namespace || ""}/${name}`;
};

// Helper function to parse resource ID
export const parseResourceId = (
  id: string,
): { resourceType: string; namespace: string; name: string } => {
  const [resourceType, rest] = id.split(":");
  const [namespace, name] = rest.split("/");
  return { resourceType, namespace, name };
};

// Helper function to format age (time since creation)
export const formatAge = (creationTimestamp: string): string => {
  const created = new Date(creationTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMins > 0) return `${diffMins}m`;
  return `${diffSecs}s`;
};

export const typeMapping: Record<string, string> = {
  Namespace: "namespace",
  Node: "node",
  Pod: "pod",
  Service: "service",
  Ingress: "ingress",
  Deployment: "deployment",
  ReplicaSet: "replicaSet",
  DaemonSet: "daemonSet",
  StatefulSet: "statefulSet",
  ConfigMap: "configMap",
  Secret: "secret",
  ServiceAccount: "serviceAccount",
  EndpointSlice: "endpointSlice",
  PersistentVolume: "persistentVolume",
  PersistentVolumeClaim: "persistentVolumeClaim",
};

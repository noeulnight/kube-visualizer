// Resource types from backend
export interface ResourceMetadata {
  name?: string;
  namespace?: string;
  creationTimestamp?: string;
  uid?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface ResourceCondition {
  type?: string;
  status?: string;
}

export interface ContainerStatus {
  name?: string;
  ready?: boolean;
  image?: string;
  restartCount?: number;
}

export interface ResourceStatus {
  phase?: string;
  availableReplicas?: number;
  fullyLabeledReplicas?: number;
  observedGeneration?: number;
  readyReplicas?: number;
  replicas?: number;
  conditions?: ResourceCondition[];
  containerStatuses?: ContainerStatus[];
  [key: string]: unknown;
}

export interface ServicePort {
  name?: string;
  port?: number;
  targetPort?: string | number;
  protocol?: string;
}

export interface ResourceSpec {
  ports?: ServicePort[];
  replicas?: number;
  strategy?: {
    type?: string;
  };
  [key: string]: unknown;
}

export interface KubernetesResource {
  metadata?: ResourceMetadata;
  spec?: ResourceSpec;
  status?: ResourceStatus;
  data?: Record<string, string>;
}

export interface ResourceData {
  resourceType: string;
  raw: KubernetesResource;
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

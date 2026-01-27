import BaseNode from "./BaseNode";
import type { BaseNodeData, BaseNodeProps } from "./BaseNode";

const createResourceNode = (defaultLabel: string, icon: string) => {
  const ResourceNode = (props: BaseNodeProps) => {
    const data: BaseNodeData = {
      ...props.data,
      label: (props.data?.label as string) || defaultLabel,
      icon,
    };

    return <BaseNode {...props} data={data} />;
  };

  ResourceNode.displayName = `${defaultLabel}Node`;
  return ResourceNode;
};

export const NamespaceNode = createResourceNode("Namespace", "ns.svg");
export const DomainNode = createResourceNode("Domain", "ing.svg"); // Using ingress for domain for now
export const NodeNode = createResourceNode("Node", "group.svg"); // K8s node group
export const PodNode = createResourceNode("Pod", "pod.svg");
export const ServiceNode = createResourceNode("Service", "svc.svg");
export const IngressNode = createResourceNode("Ingress", "ing.svg");
export const DeploymentNode = createResourceNode("Deployment", "deploy.svg");
export const ReplicaSetNode = createResourceNode("ReplicaSet", "rs.svg");
export const DaemonSetNode = createResourceNode("DaemonSet", "ds.svg");
export const StatefulSetNode = createResourceNode("StatefulSet", "sts.svg");
export const ConfigMapNode = createResourceNode("ConfigMap", "cm.svg");
export const SecretNode = createResourceNode("Secret", "secret.svg");
export const ServiceAccountNode = createResourceNode(
  "ServiceAccount",
  "sa.svg",
);
export const EndpointSliceNode = createResourceNode("EndpointSlice", "ep.svg");
export const PersistentVolumeNode = createResourceNode(
  "PersistentVolume",
  "pv.svg",
);
export const PersistentVolumeClaimNode = createResourceNode(
  "PersistentVolumeClaim",
  "pvc.svg",
);

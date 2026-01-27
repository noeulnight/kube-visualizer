import * as k8s from "@kubernetes/client-node";
import { EventEmitter } from "events";
import path from "path";
import {
  ResourceEventType,
  ResourceType,
  type ResourceData,
  type Resources,
} from "./types";

const kc = new k8s.KubeConfig();

if (process.env.KUBECONFIG) {
  kc.loadFromFile(process.env.KUBECONFIG);
} else {
  kc.loadFromCluster();
}

const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
const discoveryApi = kc.makeApiClient(k8s.DiscoveryV1Api);

export const k8sEvents = new EventEmitter();

const resourceCache: Map<string, ResourceData> = new Map();
const getResourceKey = (type: ResourceType, obj: Resources) =>
  `${type}:${obj.metadata?.namespace ?? ""}/${obj.metadata?.name}`;

const emitAndCache = (
  eventType: ResourceEventType,
  { raw, resourceType }: ResourceData,
) => {
  const key = getResourceKey(resourceType, raw);
  console.log(
    `[K8S-EVENT] ${eventType} ${resourceType} ${raw.metadata?.namespace ?? ""}/${raw.metadata?.name}`,
  );

  if (eventType === "DELETED") {
    resourceCache.delete(key);
  } else {
    resourceCache.set(key, { raw, resourceType } as ResourceData);
  }

  k8sEvents.emit("event", {
    type: eventType,
    resourceType,
    name: raw.metadata?.name,
    namespace: raw.metadata?.namespace ?? "",
    raw: raw,
  });
};

export const podInformer = k8s.makeInformer(kc, "/api/v1/pods", () =>
  coreApi.listPodForAllNamespaces(),
);

export const deploymentInformer = k8s.makeInformer(
  kc,
  "/apis/apps/v1/deployments",
  () => appsApi.listDeploymentForAllNamespaces(),
);

export const replicaSetInformer = k8s.makeInformer(
  kc,
  "/apis/apps/v1/replicasets",
  () => appsApi.listReplicaSetForAllNamespaces(),
);

export const namespaceInformer = k8s.makeInformer(
  kc,
  "/api/v1/namespaces",
  () => coreApi.listNamespace(),
);

export const nodeInformer = k8s.makeInformer(kc, "/api/v1/nodes", () =>
  coreApi.listNode(),
);

export const serviceInformer = k8s.makeInformer(kc, "/api/v1/services", () =>
  coreApi.listServiceForAllNamespaces(),
);

export const ingressInformer = k8s.makeInformer(
  kc,
  "/apis/networking.k8s.io/v1/ingresses",
  () => networkingApi.listIngressForAllNamespaces(),
);

export const daemonSetInformer = k8s.makeInformer(
  kc,
  "/apis/apps/v1/daemonsets",
  () => appsApi.listDaemonSetForAllNamespaces(),
);

export const statefulSetInformer = k8s.makeInformer(
  kc,
  "/apis/apps/v1/statefulsets",
  () => appsApi.listStatefulSetForAllNamespaces(),
);

export const configMapInformer = k8s.makeInformer(
  kc,
  "/api/v1/configmaps",
  () => coreApi.listConfigMapForAllNamespaces(),
);

export const secretInformer = k8s.makeInformer(kc, "/api/v1/secrets", () =>
  coreApi.listSecretForAllNamespaces(),
);

export const serviceAccountInformer = k8s.makeInformer(
  kc,
  "/api/v1/serviceaccounts",
  () => coreApi.listServiceAccountForAllNamespaces(),
);

export const endpointSliceInformer = k8s.makeInformer(
  kc,
  "/apis/discovery.k8s.io/v1/endpointslices",
  () => discoveryApi.listEndpointSliceForAllNamespaces(),
);

export const persistentVolumeInformer = k8s.makeInformer(
  kc,
  "/api/v1/persistentvolumes",
  () => coreApi.listPersistentVolume(),
);

export const persistentVolumeClaimInformer = k8s.makeInformer(
  kc,
  "/api/v1/persistentvolumeclaims",
  () => coreApi.listPersistentVolumeClaimForAllNamespaces(),
);

const setupInformer = (
  informer: k8s.Informer<Resources>,
  type: ResourceType,
) => {
  informer.on("add", (obj) =>
    emitAndCache(ResourceEventType.ADDED, {
      resourceType: type,
      raw: obj,
    } as ResourceData),
  );
  informer.on("update", (obj) =>
    emitAndCache(ResourceEventType.MODIFIED, {
      resourceType: type,
      raw: obj,
    } as ResourceData),
  );
  informer.on("delete", (obj) =>
    emitAndCache(ResourceEventType.DELETED, {
      resourceType: type,
      raw: obj,
    } as ResourceData),
  );
  informer.on("error", (err) => {
    console.error(`${type} Informer error:`, err);
  });
};

setupInformer(podInformer, ResourceType.Pod);
setupInformer(deploymentInformer, ResourceType.Deployment);
setupInformer(replicaSetInformer, ResourceType.ReplicaSet);
setupInformer(namespaceInformer, ResourceType.Namespace);
setupInformer(nodeInformer, ResourceType.Node);
setupInformer(serviceInformer, ResourceType.Service);
setupInformer(ingressInformer, ResourceType.Ingress);
setupInformer(daemonSetInformer, ResourceType.DaemonSet);
setupInformer(statefulSetInformer, ResourceType.StatefulSet);
setupInformer(configMapInformer, ResourceType.ConfigMap);
setupInformer(secretInformer, ResourceType.Secret);
setupInformer(serviceAccountInformer, ResourceType.ServiceAccount);
setupInformer(endpointSliceInformer, ResourceType.EndpointSlice);
setupInformer(persistentVolumeInformer, ResourceType.PersistentVolume);
setupInformer(
  persistentVolumeClaimInformer,
  ResourceType.PersistentVolumeClaim,
);

export const getCurrentState = () => {
  return Array.from(resourceCache.values());
};

export const startInformers = () => {
  const informers = [
    podInformer,
    deploymentInformer,
    replicaSetInformer,
    namespaceInformer,
    nodeInformer,
    serviceInformer,
    ingressInformer,
    daemonSetInformer,
    statefulSetInformer,
    configMapInformer,
    secretInformer,
    serviceAccountInformer,
    endpointSliceInformer,
    persistentVolumeInformer,
    persistentVolumeClaimInformer,
  ];
  informers.forEach((inf) => {
    inf.start().catch((err) => {
      console.error("Failed to start informer:", err);
    });
  });
};

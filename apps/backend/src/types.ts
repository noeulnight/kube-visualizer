import * as k8s from "@kubernetes/client-node";

export enum ResourceType {
  Pod = "Pod",
  Namespace = "Namespace",
  Node = "Node",
  Ingress = "Ingress",
  PersistentVolumeClaim = "PersistentVolumeClaim",
  PersistentVolume = "PersistentVolume",
  Deployment = "Deployment",
  ReplicaSet = "ReplicaSet",
  Service = "Service",
  ConfigMap = "ConfigMap",
  Secret = "Secret",
  ServiceAccount = "ServiceAccount",
  EndpointSlice = "EndpointSlice",
  DaemonSet = "DaemonSet",
  StatefulSet = "StatefulSet",
}

export enum ResourceEventType {
  ADDED = "ADDED",
  MODIFIED = "MODIFIED",
  DELETED = "DELETED",
}

export type Resources =
  | k8s.V1Pod
  | k8s.V1Namespace
  | k8s.V1Node
  | k8s.V1Ingress
  | k8s.V1PersistentVolumeClaim
  | k8s.V1PersistentVolume
  | k8s.V1Deployment
  | k8s.V1ReplicaSet
  | k8s.V1Service
  | k8s.V1ConfigMap
  | k8s.V1Secret
  | k8s.V1ServiceAccount
  | k8s.V1EndpointSlice
  | k8s.V1DaemonSet
  | k8s.V1StatefulSet;

export type ResourceData =
  | {
      resourceType: ResourceType.Pod;
      raw: k8s.V1Pod;
    }
  | {
      resourceType: ResourceType.Namespace;
      raw: k8s.V1Namespace;
    }
  | {
      resourceType: ResourceType.Node;
      raw: k8s.V1Node;
    }
  | {
      resourceType: ResourceType.Ingress;
      raw: k8s.V1Ingress;
    }
  | {
      resourceType: ResourceType.PersistentVolumeClaim;
      raw: k8s.V1PersistentVolumeClaim;
    }
  | {
      resourceType: ResourceType.PersistentVolume;
      raw: k8s.V1PersistentVolume;
    }
  | {
      resourceType: ResourceType.Deployment;
      raw: k8s.V1Deployment;
    }
  | {
      resourceType: ResourceType.ReplicaSet;
      raw: k8s.V1ReplicaSet;
    }
  | {
      resourceType: ResourceType.Service;
      raw: k8s.V1Service;
    }
  | {
      resourceType: ResourceType.ConfigMap;
      raw: k8s.V1ConfigMap;
    }
  | {
      resourceType: ResourceType.Secret;
      raw: k8s.V1Secret;
    }
  | {
      resourceType: ResourceType.ServiceAccount;
      raw: k8s.V1ServiceAccount;
    }
  | {
      resourceType: ResourceType.EndpointSlice;
      raw: k8s.V1EndpointSlice;
    }
  | {
      resourceType: ResourceType.DaemonSet;
      raw: k8s.V1DaemonSet;
    }
  | {
      resourceType: ResourceType.StatefulSet;
      raw: k8s.V1StatefulSet;
    };

export interface Edge {
  source: string;
  target: string;
  type: string;
}

export interface NodeMetadata {
  id: string;
  name: string;
  namespace: string | undefined;
  resourceType: ResourceType;
}

export interface Delta {
  addedNodes: NodeMetadata[];
  modifiedNodes: NodeMetadata[];

  removedNodes: string[];

  addedEdges: Edge[];
  removedEdges: Edge[];
}

import * as k8s from "@kubernetes/client-node";
import { Delta, Edge, NodeMetadata, ResourceData, ResourceType } from "./types";

const toMetadataNode = (res: ResourceData): NodeMetadata => {
  return {
    id: getResourceId(res),
    name: res.raw.metadata?.name || "",
    namespace: res.raw.metadata?.namespace ?? "",
    resourceType: res.resourceType,
  };
};

const getResourceId = (res: ResourceData): string => {
  return `${res.resourceType}:${res.raw.metadata?.namespace ?? ""}/${res.raw.metadata?.name}`;
};

const edgeKey = (edge: Edge): string => {
  return `${edge.source}|${edge.target}|${edge.type}`;
};

const addPodConfigEdges = (
  pod: k8s.V1Pod,
  id: string,
  namespace: string,
  addEdge: (edge: Edge) => void,
) => {
  pod.spec?.imagePullSecrets?.forEach((secret) => {
    if (secret.name) {
      addEdge({
        source: id,
        target: `Secret:${namespace}/${secret.name}`,
        type: "uses-secret",
      });
    }
  });

  pod.spec?.volumes?.forEach((volume) => {
    if (volume.secret?.secretName) {
      addEdge({
        source: id,
        target: `Secret:${namespace}/${volume.secret.secretName}`,
        type: "uses-secret",
      });
    }

    if (volume.configMap?.name) {
      addEdge({
        source: id,
        target: `ConfigMap:${namespace}/${volume.configMap.name}`,
        type: "uses-config",
      });
    }
  });

  pod.spec?.containers?.forEach((container) => {
    container.envFrom?.forEach((envFrom) => {
      if (envFrom.configMapRef?.name) {
        addEdge({
          source: id,
          target: `ConfigMap:${namespace}/${envFrom.configMapRef.name}`,
          type: "uses-config",
        });
      }

      if (envFrom.secretRef?.name) {
        addEdge({
          source: id,
          target: `Secret:${namespace}/${envFrom.secretRef.name}`,
          type: "uses-secret",
        });
      }
    });

    container.env?.forEach((env) => {
      const configMapName = env.valueFrom?.configMapKeyRef?.name;
      if (configMapName) {
        addEdge({
          source: id,
          target: `ConfigMap:${namespace}/${configMapName}`,
          type: "uses-config",
        });
      }

      const secretName = env.valueFrom?.secretKeyRef?.name;
      if (secretName) {
        addEdge({
          source: id,
          target: `Secret:${namespace}/${secretName}`,
          type: "uses-secret",
        });
      }
    });
  });
};

export const getEdges = (resources: ResourceData[]) => {
  const edges: { source: string; target: string; type: string }[] = [];
  const resourceIds = new Set(resources.map(getResourceId));
  const addEdge = (edge: Edge) => {
    if (resourceIds.has(edge.source) && resourceIds.has(edge.target)) {
      edges.push(edge);
    }
  };

  resources.forEach((res) => {
    const resourceType = res.resourceType;
    const raw = res.raw;
    const name = raw.metadata?.name;
    const namespace = raw.metadata?.namespace ?? "";
    const id = `${resourceType}:${namespace}/${name}`;

    // 0. Namespace -> Top-level Resources
    if (
      namespace &&
      resourceType !== "Namespace" &&
      resourceType !== "Node"
      // && resourceType !== "Service"
    ) {
      const hasGraphOwner = raw.metadata?.ownerReferences?.some((owner) =>
        resourceIds.has(`${owner.kind}:${namespace}/${owner.name}`),
      );
      if (!hasGraphOwner) {
        addEdge({
          source: `Namespace:/${namespace}`,
          target: id,
          type: "contains",
        });
      }
    }

    // 1. Owner References (Deploy -> RS -> Pod, etc.)
    if (raw.metadata?.ownerReferences) {
      raw.metadata.ownerReferences.forEach((owner) => {
        const ownerId = `${owner.kind}:${namespace}/${owner.name}`;
        addEdge({
          source: ownerId,
          target: id,
          type: "owner",
        });
      });
    }

    // 2. Service -> Pod (Labels)
    // if (resourceType === "Service") {
    //   const selector = raw.spec?.selector;
    //   if (selector) {
    //     resources
    //       .filter(
    //         (r) =>
    //           r.resourceType === "Pod" &&
    //           r.raw.metadata?.namespace === namespace,
    //       )
    //       .forEach((pod) => {
    //         if (labelsMatch(selector, pod.raw.metadata?.labels)) {
    //           edges.push({
    //             source: id,
    //             target: `Pod:${namespace}/${pod.raw.metadata?.name}`,
    //             type: "selects",
    //           });
    //         }
    //       });
    //   }
    // }

    // 3. Ingress -> Service
    if (resourceType === ResourceType.Ingress) {
      res.raw.spec?.rules?.forEach((rule) => {
        rule.http?.paths?.forEach((path) => {
          const svcName = path.backend?.service?.name;
          if (svcName) {
            addEdge({
              source: id,
              target: `Service:${namespace}/${svcName}`,
              type: "routes-to",
            });
          }
        });
      });
    }

    // 4. Node -> Pod
    if (resourceType === ResourceType.Pod) {
      const pod = res.raw as k8s.V1Pod;
      if (pod.spec?.nodeName) {
        addEdge({
          source: `Node:/${pod.spec.nodeName}`,
          target: id,
          type: "hosted-on",
        });
      }

      addPodConfigEdges(pod, id, namespace, addEdge);
    }

    // 5. Service -> EndpointSlice
    if (resourceType === ResourceType.EndpointSlice) {
      const endpointSlice = res.raw as k8s.V1EndpointSlice;
      const serviceName =
        endpointSlice.metadata?.labels?.["kubernetes.io/service-name"];
      if (serviceName) {
        addEdge({
          source: `Service:${namespace}/${serviceName}`,
          target: id,
          type: "has-endpoints",
        });
      }
    }

    // 6. PVC -> PV
    if (resourceType === ResourceType.PersistentVolumeClaim) {
      const spec = res.raw.spec as k8s.V1PersistentVolumeClaimSpec;
      if (spec.volumeName) {
        addEdge({
          source: id,
          target: `PersistentVolume:/${spec.volumeName}`,
          type: "binds-to",
        });
      }
    }
  });

  return edges;
};

export const buildDelta = (
  previousNodes: ResourceData[],
  currentNodes: ResourceData[],
): Delta => {
  // Create maps for efficient lookup
  const prevNodeMap = new Map<string, ResourceData>();
  const currNodeMap = new Map<string, ResourceData>();

  previousNodes.forEach((node) => {
    prevNodeMap.set(getResourceId(node), node);
  });

  currentNodes.forEach((node) => {
    currNodeMap.set(getResourceId(node), node);
  });

  // Find added and modified nodes
  const addedNodes: ResourceData[] = [];
  const modifiedNodes: ResourceData[] = [];

  currentNodes.forEach((currNode) => {
    const id = getResourceId(currNode);
    const prevNode = prevNodeMap.get(id);

    if (!prevNode) {
      // Node didn't exist before - it's added
      addedNodes.push(currNode);
    } else {
      // Node existed - check if it was modified
      // Compare resourceVersion to detect modifications
      const prevVersion = prevNode.raw.metadata?.resourceVersion;
      const currVersion = currNode.raw.metadata?.resourceVersion;

      if (prevVersion !== currVersion) {
        modifiedNodes.push(currNode);
      }
    }
  });

  // Find removed nodes
  const removedNodes: string[] = [];
  previousNodes.forEach((prevNode) => {
    const id = getResourceId(prevNode);
    if (!currNodeMap.has(id)) {
      removedNodes.push(id);
    }
  });

  // Calculate edges for both states
  const prevEdges = getEdges(previousNodes);
  const currEdges = getEdges(currentNodes);

  // Create edge sets for comparison
  const prevEdgeSet = new Set(prevEdges.map(edgeKey));
  const currEdgeSet = new Set(currEdges.map(edgeKey));

  // Find added edges
  const addedEdges: Edge[] = currEdges.filter(
    (edge) => !prevEdgeSet.has(edgeKey(edge)),
  );

  // Find removed edges
  const removedEdges: Edge[] = prevEdges.filter(
    (edge) => !currEdgeSet.has(edgeKey(edge)),
  );

  return {
    addedNodes: addedNodes.map(toMetadataNode),
    modifiedNodes: modifiedNodes.map(toMetadataNode),
    removedNodes,
    addedEdges,
    removedEdges,
  };
};

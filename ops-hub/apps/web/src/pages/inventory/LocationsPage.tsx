import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createBin,
  createLocation,
  deleteLocation,
  listBins,
  listLocations,
  updateLocationCapacity,
} from "../../lib/api/inventory";
import { PutawayModal } from "./PutawayModal";
import { capacityIsValid, parseCapacity } from "./capacity-form";
import { listGovernorates } from "../../lib/api/meta";
import type { Bin, Location, LocationType } from "../../lib/api/inventory";
import type { Governorate } from "../../lib/api/meta";
import { useT } from "../../lib/i18n";
import { ApiError } from "../../lib/api/client";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  Skeleton,
  Table,
  Tag,
  THead,
  TH,
  TD,
  useToast,
} from "../../components/ui";

const LOCATION_TYPES: LocationType[] = ["warehouse", "3pl", "shop", "transit"];

export function LocationsPage() {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createLocationOpen, setCreateLocationOpen] = useState(false);
  const [createBinOpen, setCreateBinOpen] = useState(false);
  const [putawayOpen, setPutawayOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: listLocations,
  });
  const locations = locationsQuery.data?.locations ?? [];
  const selected =
    locations.find((location) => location.id === selectedId) ?? null;

  const binsQuery = useQuery({
    queryKey: ["bins", selectedId],
    queryFn: () => listBins(selectedId as string),
    enabled: selectedId !== null,
  });
  const bins = binsQuery.data?.bins ?? [];

  const governoratesQuery = useQuery({
    queryKey: ["governorates"],
    queryFn: listGovernorates,
    staleTime: Infinity,
  });
  const governorates = governoratesQuery.data?.governorates ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLocation(id),
    onSuccess: async () => {
      toast.showToast("success", t("locations.deleted"));
      setSelectedId(null);
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast.showToast("error", t("locations.deleteFailedStock"));
      } else {
        toast.showToast("error", t("locations.deleteFailed"));
      }
      setDeleteTarget(null);
    },
  });

  const typeLabel = (type: LocationType): string => t(`locationType.${type}`);

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <PageHeader
        title={t("locations.title")}
        description={t("locations.description")}
        actions={
          <Button onClick={() => setCreateLocationOpen(true)}>
            {t("locations.add")}
          </Button>
        }
      />

      {locationsQuery.isLoading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : locationsQuery.isError ? (
        <ErrorState
          error={locationsQuery.error}
          onRetry={locationsQuery.refetch}
          className="rounded-lg bg-surface shadow-sm"
        />
      ) : locations.length === 0 ? (
        <EmptyState
          title={t("locations.emptyTitle")}
          description={t("locations.emptyHint")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-2 lg:col-span-1">
            <p className="px-2 py-1 text-caption font-semibold text-ink-500">
              {t("locations.listAria")}
            </p>
            <ul
              className="flex flex-col gap-1"
              aria-label={t("locations.listAria")}
            >
              {locations.map((location) => (
                <li key={location.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(location.id)}
                    className={`flex w-full flex-col gap-1 rounded-sm px-3 py-2 text-start transition-colors ${
                      selectedId === location.id
                        ? "bg-primary-lightest text-primary-dark"
                        : "hover:bg-ink-100"
                    }`}
                    aria-pressed={selectedId === location.id}
                  >
                    <span className="text-body2 font-semibold text-ink-900">
                      {location.name}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-caption text-ink-600">
                      <Tag tone="neutral">{typeLabel(location.type)}</Tag>
                      {location.governorateCode !== null ? (
                        <span>{location.governorateCode}</span>
                      ) : null}
                      {location.code !== null ? (
                        <span className="font-mono">{location.code}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4 lg:col-span-2">
            {selected === null ? (
              <p className="text-body2 text-ink-600">
                {t("locations.selectHint")}
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-subtitle2 font-bold text-ink-900">
                      {t("locations.detailTitle")}
                    </h2>
                    <p className="text-caption text-ink-600">
                      {t("locations.createdAt", {
                        date: new Date(selected.createdAt).toLocaleDateString(),
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-alert hover:bg-alert-light"
                    onClick={() => setDeleteTarget(selected)}
                  >
                    {t("locations.delete")}
                  </Button>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-body2 sm:grid-cols-3">
                  <div>
                    <dt className="text-caption text-ink-500">
                      {t("locations.col.type")}
                    </dt>
                    <dd className="mt-1">
                      <Tag tone="neutral">{typeLabel(selected.type)}</Tag>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-ink-500">
                      {t("locations.col.name")}
                    </dt>
                    <dd className="mt-1 font-semibold text-ink-900">
                      {selected.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-ink-500">
                      {t("locations.col.code")}
                    </dt>
                    <dd className="mt-1 font-mono text-ink-900">
                      {selected.code ?? t("locations.noCode")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-ink-500">
                      {t("locations.col.governorate")}
                    </dt>
                    <dd className="mt-1 text-ink-900">
                      {selected.governorateCode ?? t("locations.noCode")}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-caption text-ink-500">
                      {t("locations.col.address")}
                    </dt>
                    <dd className="mt-1 text-ink-900">
                      {selected.address ?? t("locations.noCode")}
                    </dd>
                  </div>
                </dl>

                <CapacityPanel location={selected} />

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-subtitle2 font-bold text-ink-900">
                      {t("locations.binsTitle")}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outlined"
                        disabled={bins.length === 0}
                        onClick={() => setPutawayOpen(true)}
                      >
                        {t("putaway.open")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outlined"
                        onClick={() => setCreateBinOpen(true)}
                      >
                        {t("locations.addBin")}
                      </Button>
                    </div>
                  </div>
                  {binsQuery.isLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : binsQuery.isError ? (
                    <ErrorState
                      error={binsQuery.error}
                      onRetry={binsQuery.refetch}
                    />
                  ) : bins.length === 0 ? (
                    <EmptyState
                      title={t("locations.binsEmptyTitle")}
                      description={t("locations.binsEmptyHint")}
                    />
                  ) : (
                    <div className="rounded-lg bg-surface shadow-sm">
                      <Table ariaLabel={t("locations.binsAria")} zebra>
                        <THead>
                          <tr>
                            <TH>{t("locations.bin.col.zone")}</TH>
                            <TH>{t("locations.bin.col.code")}</TH>
                            <TH>{t("locations.bin.col.capacity")}</TH>
                            <TH>{t("locations.bin.col.used")}</TH>
                          </tr>
                        </THead>
                        <tbody>
                          {bins.map((bin: Bin) => (
                            <tr
                              key={bin.id}
                              className="border-b border-ink-200 odd:bg-ink-100/60"
                            >
                              <TD>{bin.zone ?? t("locations.noZone")}</TD>
                              <TD className="font-mono text-ink-900">
                                {bin.code}
                              </TD>
                              <TD>
                                {bin.capacity === null
                                  ? t("locations.noCapacity")
                                  : bin.capacity}
                              </TD>
                              <TD>{bin.used ?? 0}</TD>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      <CreateLocationModal
        open={createLocationOpen}
        governorates={governorates}
        onClose={() => setCreateLocationOpen(false)}
        onCreated={() => {
          setCreateLocationOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["locations"] });
        }}
      />
      {selected && putawayOpen ? (
        <PutawayModal
          open={putawayOpen}
          location={selected}
          bins={bins}
          onClose={() => setPutawayOpen(false)}
        />
      ) : null}
      <CreateBinModal
        open={createBinOpen}
        locationId={selectedId}
        onClose={() => setCreateBinOpen(false)}
        onCreated={() => {
          setCreateBinOpen(false);
          if (selectedId !== null) {
            void queryClient.invalidateQueries({
              queryKey: ["bins", selectedId],
            });
          }
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget !== null && deleteMutation.mutate(deleteTarget.id)
        }
        title={t("locations.deleteConfirmTitle")}
        body={t("locations.deleteConfirmBody", {
          name: deleteTarget?.name ?? "",
        })}
        confirmLabel={t("action.delete")}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

function CreateLocationModal({
  open,
  governorates,
  onClose,
  onCreated,
}: {
  open: boolean;
  governorates: Governorate[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [type, setType] = useState<LocationType>("warehouse");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [governorateCode, setGovernorateCode] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createLocation({
        type,
        name: name.trim(),
        code: code.trim() === "" ? null : code.trim(),
        governorateCode: governorateCode === "" ? null : governorateCode,
        address: address.trim() === "" ? null : address.trim(),
        capacity: parseCapacity(capacity),
      }),
    onSuccess: () => {
      toast.showToast("success", t("locations.created"));
      setName("");
      setCode("");
      setGovernorateCode("");
      setAddress("");
      setCapacity("");
      onCreated();
    },
    onError: () => toast.showToast("error", t("locations.createFailed")),
  });

  const governorateOptions = [
    { value: "", label: t("locationForm.governorateOptional") },
    ...governorates.map((governorate) => ({
      value: governorate.code,
      label: governorate.nameAr,
    })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("locationForm.createTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={name.trim() === "" || !capacityIsValid(capacity)}
            onClick={() => mutation.mutate()}
          >
            {t("action.save")}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => event.preventDefault()}
      >
        <Select
          label={t("locationForm.type")}
          options={LOCATION_TYPES.map((value) => ({
            value,
            label: t(`locationType.${value}`),
          }))}
          value={type}
          onChange={(event) => setType(event.target.value as LocationType)}
        />
        <Input
          label={t("locationForm.name")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <Input
          label={t("locationForm.code")}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          hint={t("locationForm.codeHint")}
        />
        <Select
          label={t("locationForm.governorate")}
          options={governorateOptions}
          value={governorateCode}
          onChange={(event) => setGovernorateCode(event.target.value)}
        />
        <Input
          label={t("locationForm.address")}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          hint={t("locationForm.addressHint")}
        />
      </form>
    </Modal>
  );
}

function CreateBinModal({
  open,
  locationId,
  onClose,
  onCreated,
}: {
  open: boolean;
  locationId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [zone, setZone] = useState("");
  const [code, setCode] = useState("");
  const [capacity, setCapacity] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createBin({
        locationId: locationId as string,
        code: code.trim(),
        zone: zone.trim() === "" ? null : zone.trim(),
        capacity: capacity.trim() === "" ? null : Number(capacity),
      }),
    onSuccess: () => {
      toast.showToast("success", t("locations.binCreated"));
      setZone("");
      setCode("");
      setCapacity("");
      onCreated();
    },
    onError: () => toast.showToast("error", t("locations.binCreateFailed")),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("binForm.createTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={code.trim() === "" || locationId === null}
            onClick={() => mutation.mutate()}
          >
            {t("action.save")}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => event.preventDefault()}
      >
        <Input
          label={t("binForm.zone")}
          value={zone}
          onChange={(event) => setZone(event.target.value)}
          hint={t("binForm.zoneHint")}
        />
        <Input
          label={t("binForm.code")}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder={t("binForm.codePlaceholder")}
          required
          className="font-mono"
        />
        <Input
          label={t("binForm.capacity")}
          type="number"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          hint={t("binForm.capacityHint")}
        />
      </form>
    </Modal>
  );
}

function CapacityPanel({ location }: { location: Location }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const usage = location.usedUnits;
  const over =
    location.utilizationPercent !== null && location.utilizationPercent > 100;

  return (
    <section aria-labelledby="capacity-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3
          id="capacity-title"
          className="text-subtitle2 font-bold text-ink-900"
        >
          {t("locations.capacity.title")}
        </h3>
        <Button size="sm" variant="outlined" onClick={() => setEditing(true)}>
          {t("locations.capacity.edit")}
        </Button>
      </div>
      {location.capacity === null ? (
        <p className="text-body2 text-ink-700">
          {t("locations.capacity.used", { used: usage })} —{" "}
          {t("locations.capacity.unlimited")}
        </p>
      ) : (
        <>
          <p className="text-body2 text-ink-700">
            {t("locations.capacity.used", { used: usage })}{" "}
            {t("locations.capacity.of", { capacity: location.capacity })}
          </p>
          <ProgressBar
            value={location.utilizationPercent ?? 0}
            label={t("locations.capacity.title")}
          />
          {over ? (
            <p role="alert" className="text-body2 font-semibold text-danger">
              {t("locations.capacity.over")}
            </p>
          ) : null}
        </>
      )}
      {editing ? (
        <EditCapacityModal
          location={location}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </section>
  );
}

function EditCapacityModal({
  location,
  onClose,
}: {
  location: Location;
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(
    location.capacity === null ? "" : String(location.capacity),
  );
  const valid = capacityIsValid(value);

  const mutation = useMutation({
    mutationFn: () => updateLocationCapacity(location.id, parseCapacity(value)),
    onSuccess: async () => {
      toast.showToast("success", t("locations.capacity.saved"));
      await queryClient.invalidateQueries({ queryKey: ["locations"] });
      onClose();
    },
    onError: () => toast.showToast("error", t("locations.capacity.saveFailed")),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={t("locations.capacity.edit")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={!valid}
            onClick={() => mutation.mutate()}
          >
            {t("action.save")}
          </Button>
        </>
      }
    >
      <Input
        label={t("locations.capacity.label")}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        hint={t("locations.capacity.hint")}
        error={valid ? null : t("locations.capacity.invalid")}
        inputMode="numeric"
        dir="ltr"
      />
    </Modal>
  );
}

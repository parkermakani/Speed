import React, { useEffect, useState } from "react";
import { Card, Stack, Text, Button, Input, FormField } from "./primitives";
import {
  fetchMerch,
  createMerch,
  updateMerch,
  ApiError,
} from "../services/api";
import type { MerchItem } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { firebaseStorage } from "../services/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface AdminMerchProps {}

export const AdminMerch: React.FC<AdminMerchProps> = () => {
  const { token } = useAuth();
  const [items, setItems] = useState<MerchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setItems(await fetchMerch());
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "Failed to load merch");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggleActive = async (id: string, active: boolean) => {
    if (!token) return;
    try {
      await updateMerch(id, { active: !active }, token);
      await load();
    } catch {}
  };

  // ---------- Add / Edit Form ----------
  const [form, setForm] = useState({
    name: "",
    price: "",
    url: "",
    imageFile: null as File | null,
  });
  const [showForm, setShowForm] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setForm((f) => ({ ...f, imageFile: file }));
  };

  const resetForm = () =>
    setForm({ name: "", price: "", url: "", imageFile: null });

  const handleSubmit = async () => {
    if (!token) return;
    if (!form.name || !form.price) {
      alert("Name and price are required");
      return;
    }
    setLoading(true);
    try {
      let imageUrl = "";
      if (form.imageFile) {
        const storageRef = ref(
          firebaseStorage,
          `merch/${Date.now()}_${form.imageFile.name}`
        );
        await uploadBytes(storageRef, form.imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      await createMerch(
        {
          name: form.name,
          price: form.price,
          url: form.url,
          imageUrl,
          active: true,
        },
        token
      );
      resetForm();
      setShowForm(false);
      await load();
    } catch (e) {
      alert("Failed to create merch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      padding="md"
      style={{ width: "100%", maxWidth: "800px", margin: "0 auto" }}
    >
      <Stack spacing="sm">
        <Stack direction="row" justify="between" align="center">
          <Text size="lg" weight="medium">
            Merch Items
          </Text>
          {!showForm && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowForm(true)}
            >
              Add New
            </Button>
          )}
        </Stack>

        {showForm && (
          <Card variant="outlined" padding="md">
            <Stack spacing="sm">
              <FormField label="Name" required>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  fullWidth
                />
              </FormField>
              <FormField label="Price" required>
                <Input
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                  fullWidth
                />
              </FormField>
              <FormField label="Product URL">
                <Input
                  value={form.url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, url: e.target.value }))
                  }
                  fullWidth
                />
              </FormField>
              <FormField label="Image">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </FormField>

              <Stack direction="row" spacing="sm" justify="end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  loading={loading}
                >
                  Save
                </Button>
              </Stack>
            </Stack>
          </Card>
        )}
        {error && (
          <Text size="sm" color="error">
            {error}
          </Text>
        )}
        <div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr
                  key={it.id}
                  style={{ borderTop: "1px solid var(--color-border)" }}
                >
                  <td>{it.name}</td>
                  <td>{it.price}</td>
                  <td>{it.active ? "Yes" : "No"}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleToggleActive(it.id, it.active)}
                    >
                      {it.active ? "Disable" : "Enable"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Stack>
    </Card>
  );
};

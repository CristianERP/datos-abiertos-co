from etl.fetch import load_dataset_registry

REQUIRED_FIELDS = {"id", "ministerio", "dataset_id", "frecuencia"}


def test_each_entry_has_required_fields():
    for entry in load_dataset_registry():
        missing = REQUIRED_FIELDS - entry.keys()
        assert not missing, f"{entry.get('id', '<sin id>')} le falta: {missing}"


def test_ids_are_unique():
    ids = [entry["id"] for entry in load_dataset_registry()]
    assert len(ids) == len(set(ids)), "hay ids duplicados en datasets.yaml"

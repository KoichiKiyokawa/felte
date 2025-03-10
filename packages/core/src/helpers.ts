import type {
  Errors,
  Extender,
  FieldValue,
  FormConfig,
  Obj,
  Stores,
  Touched,
  ValidationFunction,
  TransformFunction,
  Setter,
  ObjectSetter,
  PartialErrorsSetter,
  AssignableErrors,
  PrimitiveSetter,
  FieldsSetter,
  Helpers,
  Keyed,
} from '@felte/common';
import {
  deepSet,
  setForm,
  _cloneDeep,
  _get,
  _set,
  _unset,
  _update,
  _isPlainObject,
  createId,
} from '@felte/common';
import { get } from './get';
import { deepSetTouched } from './deep-set-touched';
import { deepSetKey } from './deep-set-key';

type CreateHelpersOptions<Data extends Obj> = {
  config: FormConfig<Data>;
  stores: Stores<Data>;
  validateErrors(data: Data | Keyed<Data>): Promise<Errors<Data> | undefined>;
  validateWarnings(data: Data | Keyed<Data>): Promise<Errors<Data> | undefined>;
  extender: Extender<Data>[];
  addValidator(validator: ValidationFunction<Data>): void;
  addTransformer(transformer: TransformFunction<Data>): void;
};

function addAtIndex<Data extends Obj>(
  storeValue: Data,
  path: string,
  value: any,
  index?: number
) {
  return _update(storeValue, path, (oldValue) => {
    if (typeof oldValue !== 'undefined' && !Array.isArray(oldValue))
      return oldValue;
    if (!oldValue) oldValue = [];
    if (typeof index === 'undefined') {
      oldValue.push(value);
    } else {
      oldValue.splice(index, 0, value);
    }
    return oldValue;
  });
}

function swapInArray<Data extends Obj>(
  storeValue: Data,
  path: string,
  from: number,
  to: number
) {
  return _update(storeValue, path, (oldValue) => {
    if (!oldValue || !Array.isArray(oldValue)) return oldValue;
    [oldValue[from], oldValue[to]] = [oldValue[to], oldValue[from]];
    return oldValue;
  });
}

function moveInArray<Data extends Obj>(
  storeValue: Data,
  path: string,
  from: number,
  to: number
) {
  return _update(storeValue, path, (oldValue) => {
    if (!oldValue || !Array.isArray(oldValue)) return oldValue;
    oldValue.splice(to, 0, oldValue.splice(from, 1)[0] as any);
    return oldValue;
  });
}

function isUpdater<T>(value: unknown): value is (value: T) => T {
  return typeof value === 'function';
}

function createSetHelper<Data extends Obj, Path extends string>(
  storeSetter: (
    updater: (value: Errors<Data>) => AssignableErrors<Data>
  ) => void
): PartialErrorsSetter<Data, Path>;
function createSetHelper<Data extends Obj, Path extends string>(
  storeSetter: (updater: (value: Data) => Data) => void
): ObjectSetter<Data, Path>;
function createSetHelper<Data extends boolean | string | null>(
  storeSetter: (updater: (value: Data) => Data) => void
): PrimitiveSetter<Data>;
function createSetHelper<Data extends Obj | boolean>(
  storeSetter: (updater: (value: Data) => Data) => void
): Setter<Data> {
  const setHelper = (
    pathOrValue: string | Data | ((value: Data) => Data),
    valueOrUpdater?: unknown | ((value: unknown) => unknown)
  ) => {
    if (typeof pathOrValue === 'string') {
      const path = pathOrValue;
      storeSetter((oldValue) => {
        const newValue = isUpdater(valueOrUpdater)
          ? (valueOrUpdater(_get(oldValue as Obj, path)) as Data)
          : valueOrUpdater;
        return _set(
          oldValue as Obj,
          path,
          newValue as FieldValue | FieldValue[]
        ) as Data;
      });
    } else {
      storeSetter((oldValue) =>
        isUpdater<Data>(pathOrValue) ? pathOrValue(oldValue) : pathOrValue
      );
    }
  };

  return setHelper as Setter<Data>;
}

export function createHelpers<Data extends Obj>({
  stores,
  config,
  validateErrors,
  validateWarnings,
}: CreateHelpersOptions<Data>) {
  let formNode: HTMLFormElement | undefined;
  let initialValues = deepSetKey((config.initialValues ?? {}) as Data);

  const {
    data,
    touched,
    errors,
    warnings,
    isDirty,
    isSubmitting,
    interacted,
  } = stores;

  const setData = createSetHelper<Data, string>(data.update);

  const setTouched = createSetHelper<Touched<Data>, string>(touched.update);

  const setErrors = createSetHelper<Data, string>(errors.update);

  const setWarnings = createSetHelper<Data, string>(warnings.update);

  function updateFields(updater: (values: Data) => Data) {
    setData((oldData) => {
      const newData = updater(oldData);
      if (formNode) setForm(formNode, newData);
      return newData;
    });
  }

  const setFields: FieldsSetter<Data, string> = (
    pathOrValue: string | Data | ((value: Data) => Data),
    valueOrUpdater?: unknown | ((value: unknown) => unknown),
    shouldTouch?: boolean
  ) => {
    const fieldsSetter = createSetHelper<Data, string>(updateFields);
    fieldsSetter(pathOrValue as any, valueOrUpdater as any);
    if (typeof pathOrValue === 'string' && shouldTouch) {
      setTouched<string, any>(pathOrValue, true);
    }
  };

  function addField(path: string, value: unknown, index?: number) {
    const touchedValue = _isPlainObject(value)
      ? deepSetTouched(value, false)
      : false;
    const errValue = _isPlainObject(touchedValue)
      ? deepSet(touchedValue, [])
      : [];
    value = _isPlainObject(value) ? { ...value, key: createId() } : value;
    errors.update(($errors) => {
      return addAtIndex($errors, path, errValue, index);
    });
    warnings.update(($warnings) => {
      return addAtIndex($warnings, path, errValue, index);
    });
    touched.update(($touched) => {
      return addAtIndex($touched, path, touchedValue, index);
    });
    data.update(($data) => {
      const newData = addAtIndex($data, path, value, index);
      setTimeout(() => formNode && setForm(formNode, newData));
      return newData;
    });
  }

  function updateAll(updater: <Data extends Obj>(storeValue: Data) => Data) {
    errors.update(updater);
    warnings.update(updater);
    touched.update(updater);
    data.update(($data) => {
      const newData = updater($data);
      setTimeout(() => formNode && setForm(formNode, newData));
      return newData;
    });
  }

  function unsetField(path: string) {
    updateAll((storeValue) => _unset(storeValue, path));
  }

  function swapFields(path: string, from: number, to: number) {
    updateAll((storeValue) => swapInArray(storeValue, path, from, to));
  }

  function moveField(path: string, from: number, to: number) {
    updateAll((storeValue) => moveInArray(storeValue, path, from, to));
  }

  function resetField(path: string) {
    const initialValue = _get(initialValues, path);
    const touchedValue: any = _isPlainObject(initialValue)
      ? deepSetTouched(initialValue as Obj, false)
      : false;
    const errValue: any = _isPlainObject(touchedValue)
      ? deepSet(touchedValue, [])
      : [];
    data.update(($data) => {
      const newData = _set($data, path, initialValue);
      if (formNode) setForm(formNode, newData);
      return newData;
    });
    touched.update(($touched) => {
      return _set($touched, path, touchedValue);
    });
    errors.update(($errors) => {
      return _set($errors, path, errValue);
    });
    warnings.update(($warnings) => {
      return _set($warnings, path, errValue);
    });
  }

  const setIsSubmitting = createSetHelper(isSubmitting.update);

  const setIsDirty = createSetHelper(isDirty.update);

  const setInteracted = createSetHelper(interacted.update);

  async function validate(): Promise<Errors<Data> | void> {
    const currentData = get(data);
    touched.set(deepSetTouched(currentData, true));
    interacted.set(null);
    const currentErrors = await validateErrors(currentData);
    await validateWarnings(currentData);
    return currentErrors;
  }

  function reset(): void {
    setFields(_cloneDeep(initialValues));
    setTouched(($touched) => deepSet($touched, false) as Touched<Data>);
    interacted.set(null);
    isDirty.set(false);
  }

  const publicHelpers: Helpers<Data> = {
    setData,
    setFields,
    setTouched,
    setErrors,
    setWarnings,
    setIsSubmitting,
    setIsDirty,
    setInteracted,
    validate,
    reset,
    unsetField,
    resetField,
    addField,
    swapFields,
    moveField,
    setInitialValues: (values: Data) => {
      initialValues = deepSetKey(values);
    },
  };

  const privateHelpers = {
    _setFormNode(node: HTMLFormElement) {
      formNode = node;
    },
    _getFormNode: () => formNode,
    _getInitialValues: () => initialValues,
  };

  return {
    public: publicHelpers,
    private: privateHelpers,
  };
}

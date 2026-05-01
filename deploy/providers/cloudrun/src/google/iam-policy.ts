export type IamPolicyBindingLike = {
  condition?: null | unknown;
  members?: null | string[];
  role?: null | string;
};

export type IamPolicyLike = {
  bindings?: IamPolicyBindingLike[] | null;
};

export function addIamBindingMember<TPolicy extends IamPolicyLike>(
  policy: TPolicy,
  input: {
    member: string;
    role: string;
  },
): TPolicy {
  const bindings = policy.bindings ?? [];
  const existingBinding = bindings.find(
    (binding) => binding.role === input.role && binding.condition == null,
  );

  if (existingBinding !== undefined) {
    const members = existingBinding.members ?? [];

    if (members.includes(input.member)) {
      return policy;
    }

    return {
      ...policy,
      bindings: bindings.map((binding) =>
        binding === existingBinding
          ? {
              ...binding,
              members: [...members, input.member],
            }
          : binding,
      ),
    };
  }

  return {
    ...policy,
    bindings: [
      ...bindings,
      {
        members: [input.member],
        role: input.role,
      },
    ],
  };
}

<script>
  import { createForm } from 'felte';
  import reporter from '@felte/reporter-tippy';
  import { validator } from '@felte/validator-yup';
  import * as yup from 'yup';

  const schema = yup.object({
    email: yup.string().email().required(),
    password: yup.string().required(),
  });

  const { form } = createForm({
    onSubmit: () => {
      throw {
        password: 'This password already exists',
      };
    },
    onError: error => error,
    extend: [validator({ schema }), reporter()],
  });
</script>

<form use:form>
  <label>
    <span>Email:</span>
    <input name="email" type="email" aria-describedby="signin-description">
  </label>
  <span id="signin-description">Use any value you want, this is just a demo.</span>
  <label>
    <span>Password:</span>
    <input name="password" type="password">
  </label>
  <button type="submit">Fail to sign in</button>
</form>

<style>
  form {
    display: inline-block;
    font-size: 1.2em;
    background: var(--example-background);
    padding: 2rem;
    border-radius: 10px 30px;
  }

  #signin-description {
    font-size: 0.7em;
  }

  label, input {
    display: block;
  }

  label span {
    font-weight: 700;
    margin-top: 0.7em;
  }

  button {
    margin-top: 0.7em;
    font-size: 0.8em;
    font-weight: 700;
    padding: 0.7em;
    background: var(--highlight-background);
    border-radius: 10px;
    border: none;
    color: var(--on-highlight-color);
    transition: transform 0.1s;
  }

  button:hover {
    background: var(--highlight-background-hover);
  }

  button:active {
    transform: scale(0.9);
  }
</style>

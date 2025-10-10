<?php defined('BASEPATH') or exit('No direct script access allowed');

/* ----------------------------------------------------------------------------
 * Easy!Appointments - Online Appointment Scheduler
 *
 * @package     EasyAppointments
 * @author      A.Tselegidis <alextselegidis@gmail.com>
 * @copyright   Copyright (c) Alex Tselegidis
 * @license     https://opensource.org/licenses/GPL-3.0 - GPLv3
 * @link        https://easyappointments.org
 * @since       v1.0.0
 * ---------------------------------------------------------------------------- */

/**
 * Providers controller.
 *
 * Handles the providers related operations.
 *
 * @package Controllers
 */
class Providers extends EA_Controller
{
    public array $allowed_provider_fields = [
        'id',
        'first_name',
        'last_name',
        'email',
        'mobile_number',
        'alt_number',
        'phone_number',
        'address',
        'city',
        'state',
        'zip_code',
        'notes',
        'timezone',
        'language',
        'is_private',
        'ldap_dn',
        'photo',
        'id_roles',
        'settings',
        'services',
    ];

    public array $optional_provider_fields = [
        'services' => [],
        'photo' => null,
    ];

    public array $allowed_provider_setting_fields = [
        'username',
        'password',
        'working_plan',
        'working_plan_exceptions',
        'notifications',
        'calendar_view',
    ];

    public array $optional_provider_setting_fields = [
        'working_plan' => null,
        'working_plan_exceptions' => '{}',
    ];

    public array $allowed_service_fields = ['id', 'name'];

    /**
     * Providers constructor.
     */
    public function __construct()
    {
        parent::__construct();

        $this->load->model('providers_model');
        $this->load->model('services_model');
        $this->load->model('roles_model');

        $this->load->library('accounts');
        $this->load->library('timezones');
        $this->load->library('webhooks_client');

        $this->optional_provider_setting_fields['working_plan'] = setting('company_working_plan');
    }

    /**
     * Render the backend providers page.
     *
     * On this page admin users will be able to manage providers, which are eventually selected by customers during the
     * booking process.
     */
    public function index(): void
    {
        session(['dest_url' => site_url('providers')]);

        $user_id = session('user_id');

        if (cannot('view', PRIV_USERS)) {
            if ($user_id) {
                abort(403, 'Forbidden');
            }

            redirect('login');

            return;
        }

        $role_slug = session('role_slug');

        $services = $this->services_model->get();

        foreach ($services as &$service) {
            $this->services_model->only($service, $this->allowed_service_fields);
        }

        script_vars([
            'user_id' => $user_id,
            'role_slug' => $role_slug,
            'company_working_plan' => setting('company_working_plan'),
            'date_format' => setting('date_format'),
            'time_format' => setting('time_format'),
            'first_weekday' => setting('first_weekday'),
            'min_password_length' => MIN_PASSWORD_LENGTH,
            'timezones' => $this->timezones->to_array(),
            'services' => $services,
            'default_language' => setting('default_language'),
            'default_timezone' => setting('default_timezone'),
        ]);

        html_vars([
            'page_title' => lang('providers'),
            'active_menu' => PRIV_USERS,
            'user_display_name' => $this->accounts->get_user_display_name($user_id),
            'grouped_timezones' => $this->timezones->to_grouped_array(),
            'privileges' => $this->roles_model->get_permissions_by_slug($role_slug),
            'services' => $this->services_model->get(),
        ]);

        $this->load->view('pages/providers');
    }

    /**
     * Filter providers by the provided keyword.
     */
    public function search(): void
    {
        try {
            if (cannot('view', PRIV_USERS)) {
                abort(403, 'Forbidden');
            }

            $keyword = request('keyword', '');

            $order_by = request('order_by', 'update_datetime DESC');

            $limit = request('limit', 1000);

            $offset = (int) request('offset', '0');

            $providers = $this->providers_model->search($keyword, $limit, $offset, $order_by);

            json_response($providers);
        } catch (Throwable $e) {
            json_exception($e);
        }
    }

    /**
     * Store a new provider.
     */
    public function store(): void
    {
        try {
            if (cannot('add', PRIV_USERS)) {
                abort(403, 'Forbidden');
            }

            $provider = $this->decode_provider_payload(request('provider'));

            $remove_photo = !empty($provider['remove_photo']);

            unset($provider['remove_photo']);

            $this->providers_model->only($provider, $this->allowed_provider_fields);

            $this->providers_model->only($provider['settings'], $this->allowed_provider_setting_fields);

            $this->providers_model->optional($provider, $this->optional_provider_fields);

            $this->providers_model->optional($provider['settings'], $this->optional_provider_setting_fields);

            $this->handle_photo_upload($provider, $remove_photo);

            $provider_id = $this->providers_model->save($provider);

            $provider = $this->providers_model->find($provider_id);

            $this->webhooks_client->trigger(WEBHOOK_PROVIDER_SAVE, $provider);

            json_response([
                'success' => true,
                'id' => $provider_id,
            ]);
        } catch (Throwable $e) {
            json_exception($e);
        }
    }

    /**
     * Find a provider.
     */
    public function find(): void
    {
        try {
            if (cannot('view', PRIV_USERS)) {
                abort(403, 'Forbidden');
            }

            $provider_id = request('provider_id');

            $provider = $this->providers_model->find($provider_id);

            json_response($provider);
        } catch (Throwable $e) {
            json_exception($e);
        }
    }

    /**
     * Update a provider.
     */
    public function update(): void
    {
        try {
            if (cannot('edit', PRIV_USERS)) {
                abort(403, 'Forbidden');
            }

            $provider = $this->decode_provider_payload(request('provider'));

            $remove_photo = !empty($provider['remove_photo']);

            $existing_provider = null;

            if (!empty($provider['id'])) {
                $existing_provider = $this->providers_model->find($provider['id']);
            }

            unset($provider['remove_photo']);

            $this->providers_model->only($provider, $this->allowed_provider_fields);

            $this->providers_model->only($provider['settings'], $this->allowed_provider_setting_fields);

            $this->providers_model->optional($provider, $this->optional_provider_fields);

            $this->providers_model->optional($provider['settings'], $this->optional_provider_setting_fields);

            $this->handle_photo_upload($provider, $remove_photo, $existing_provider);

            $provider_id = $this->providers_model->save($provider);

            $provider = $this->providers_model->find($provider_id);

            $this->webhooks_client->trigger(WEBHOOK_PROVIDER_SAVE, $provider);

            json_response([
                'success' => true,
                'id' => $provider_id,
            ]);
        } catch (Throwable $e) {
            json_exception($e);
        }
    }

    /**
     * Remove a provider.
     */
    public function destroy(): void
    {
        try {
            if (cannot('delete', PRIV_USERS)) {
                abort(403, 'Forbidden');
            }

            $provider_id = request('provider_id');

            $provider = $this->providers_model->find($provider_id);

            $this->delete_photo_file($provider['photo'] ?? null);

            $this->providers_model->delete($provider_id);

            $this->webhooks_client->trigger(WEBHOOK_PROVIDER_DELETE, $provider);

            json_response([
                'success' => true,
            ]);
        } catch (Throwable $e) {
            json_exception($e);
        }
    }

    private function decode_provider_payload(mixed $payload): array
    {
        if (is_array($payload)) {
            return $payload;
        }

        if (is_string($payload)) {
            $decoded = json_decode($payload, true);

            if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
                throw new InvalidArgumentException('Invalid provider payload.');
            }

            return $decoded;
        }

        return [];
    }

    private function handle_photo_upload(array &$provider, bool $remove_photo, ?array $original_provider = null): void
    {
        $existing_photo = $original_provider['photo'] ?? null;

        if (!empty($_FILES['photo']['name'])) {
            $upload_path = FCPATH . 'storage/uploads/providers';

            if (!is_dir($upload_path) && !mkdir($upload_path, 0775, true) && !is_dir($upload_path)) {
                throw new RuntimeException('Unable to create providers upload directory.');
            }

            $config = [
                'upload_path' => $upload_path,
                'allowed_types' => 'gif|jpg|jpeg|png|webp',
                'max_size' => 2048,
                'encrypt_name' => true,
            ];

            $this->load->library('upload');

            $this->upload->initialize($config);

            if (!$this->upload->do_upload('photo')) {
                throw new RuntimeException(trim(strip_tags($this->upload->display_errors('', ''))));
            }

            $data = $this->upload->data();

            $provider['photo'] = 'storage/uploads/providers/' . $data['file_name'];

            if ($existing_photo && $existing_photo !== $provider['photo']) {
                $this->delete_photo_file($existing_photo);
            }

            return;
        }

        if ($remove_photo && $existing_photo) {
            $this->delete_photo_file($existing_photo);
            $provider['photo'] = null;

            return;
        }

        if ($existing_photo !== null) {
            $provider['photo'] = $existing_photo;
        }
    }

    private function delete_photo_file(?string $path): void
    {
        if (empty($path)) {
            return;
        }

        $full_path = FCPATH . ltrim($path, '/');

        if (is_file($full_path)) {
            @unlink($full_path);
        }
    }
}
